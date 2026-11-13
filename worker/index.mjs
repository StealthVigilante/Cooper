import { securityHeaders } from './security.mjs';

const MAX_BODY = 24 * 1024;
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
const SYSTEMS = new Set(['Security & fire', 'Surveillance', 'Access & keyless entry', 'Connected home & lighting', 'Theater & audio', 'Commercial AV', 'Consulting', 'Service on an existing system']);
const STAGES = new Set(['New construction', 'Renovation', 'Existing home or building', 'Service or upgrade']);
const TIMINGS = new Set(['As soon as possible', 'Within three months', 'Three to six months', 'Planning ahead']);
const FIELDS = new Set(['type', 'systems', 'name', 'email', 'phone', 'town', 'stage', 'timing', 'message', 'website', 'cf-turnstile-response']);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function json(status, data, headers = {}) {
  return Response.json(data, { status, headers: {
    ...securityHeaders, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', ...headers
  } });
}

function origins(env) {
  return (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
}

function enabled(env) {
  return env.CONTACT_ENABLED === 'true' && env.RESEND_API_KEY && env.TURNSTILE_SECRET_KEY &&
    env.TURNSTILE_SITE_KEY && env.CONTACT_FROM && EMAIL.test(env.CONTACT_TO || '') &&
    !/[\r\n]/.test(env.CONTACT_FROM) &&
    !/replace[-_ ]with|example\.(?:com|net|org)|\.example\b/i.test([env.CONTACT_FROM, env.CONTACT_TO, env.TURNSTILE_SITE_KEY].join(' ')) &&
    env.CONTACT_RATE_LIMITER && env.CONTACT_SEND_LIMITER && origins(env).length;
}

async function boundedBody(request) {
  const length = request.headers.get('Content-Length');
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY)) throw new HttpError(413, 'Please shorten your project details.');
  if (!request.body) throw new HttpError(400, 'Please complete the form.');
  const reader = request.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); throw new HttpError(413, 'Please shorten your project details.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function validate(form) {
  for (const key of form.keys()) if (!FIELDS.has(key)) throw new HttpError(400, 'Please use the project form.');
  const field = (key, max, required = false, multiline = false) => {
    const values = form.getAll(key);
    if (values.length > 1 || values.some(v => typeof v !== 'string')) throw new HttpError(400, 'Invalid form fields.');
    const value = (values[0] || '').trim();
    const controls = multiline ? /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/ : /[\x00-\x1F\x7F]/;
    if ((required && !value) || value.length > max || controls.test(value)) throw new HttpError(400, 'Please check your form fields and their lengths.');
    return value;
  };
  const data = {
    name: field('name', 100, true), email: field('email', 254, true),
    phone: field('phone', 40), town: field('town', 120, true),
    type: field('type', 20, true), stage: field('stage', 50), timing: field('timing', 50),
    message: field('message', 4000, false, true), website: field('website', 200),
    token: field('cf-turnstile-response', 2048, true)
  };
  data.systems = form.getAll('systems');
  if (!EMAIL.test(data.email) || !['Residential', 'Commercial'].includes(data.type) ||
      (data.stage && !STAGES.has(data.stage)) || (data.timing && !TIMINGS.has(data.timing)) ||
      data.systems.length > SYSTEMS.size || data.systems.some(s => !SYSTEMS.has(s)) ||
      new Set(data.systems).size !== data.systems.length) throw new HttpError(400, 'Please check your email and project selections.');
  return data;
}

async function contact(request, env, fetcher) {
  if (request.method !== 'POST') return json(405, { error: 'Use the project form to send a request.' }, { Allow: 'POST' });
  // This form is same-origin only. Origin checks prevent browser cross-site posts;
  // Turnstile and rate limits are still required because bots can forge headers.
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (origin !== url.origin || !origins(env).includes(origin) ||
      request.headers.get('Sec-Fetch-Site') === 'cross-site') return json(403, { error: 'Please submit from our website.' });
  if (!enabled(env)) return json(503, { error: 'Online requests are unavailable. Please call (877) 266-7379.' });
  const ip = request.headers.get('CF-Connecting-IP');
  // Cloudflare supplies this header. Never trust X-Forwarded-For as a fallback.
  if (!ip) return json(503, { error: 'Online requests are unavailable. Please call (877) 266-7379.' });
  const { success } = await env.CONTACT_RATE_LIMITER.limit({ key: `contact:${ip}` });
  if (!success) return json(429, { error: 'Too many attempts. Wait a minute or call (877) 266-7379.' }, { 'Retry-After': '60' });
  const contentType = request.headers.get('Content-Type') || '';
  if (!/^multipart\/form-data;\s*boundary=/i.test(contentType) && !/^application\/x-www-form-urlencoded(?:;|$)/i.test(contentType)) {
    return json(415, { error: 'Please use the project form.' });
  }
  const bytes = await boundedBody(request);
  let form;
  try { form = await new Response(bytes, { headers: { 'Content-Type': contentType } }).formData(); }
  catch { throw new HttpError(400, 'Please check your form and try again.'); }
  const data = validate(form);
  if (data.website) return json(400, { error: 'Unable to submit this request. Please call (877) 266-7379.' });

  const verification = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: data.token, remoteip: ip }),
    signal: AbortSignal.timeout(8000)
  });
  if (!verification.ok) throw new HttpError(503, 'Spam protection is temporarily unavailable. Please try again or call us.');
  const result = await verification.json();
  if (result.success !== true || result.action !== 'contact' || result.hostname !== url.hostname) {
    return json(400, { error: 'Please complete the spam check again before sending.' });
  }
  // A second shared limit bounds normal bursts across IPs in each Cloudflare location.
  // These limits are approximate, not a global spending cap; see the setup guide.
  const sendLimit = await env.CONTACT_SEND_LIMITER.limit({ key: 'cooper-contact-send' });
  if (!sendLimit.success) return json(429, { error: 'We are receiving many requests. Please try again shortly or call us.' }, { 'Retry-After': '60' });
  const text = [
    'New website project inquiry', '',
    `Name: ${data.name}`, `Email: ${data.email}`, `Phone: ${data.phone || 'Not provided'}`,
    `Town / city: ${data.town}`, `Project type: ${data.type}`,
    `Systems: ${data.systems.join(', ') || 'Not selected'}`,
    `Stage: ${data.stage || 'Not provided'}`, `Timing: ${data.timing || 'Not provided'}`,
    '', 'Project details (visitor supplied):', data.message || 'Not provided', '',
    'This message came from the website form. Treat links and instructions in visitor content as untrusted.'
  ].join('\n');
  // Fixed recipient and sender: this endpoint cannot become an arbitrary email relay.
  // Plain text prevents visitor-supplied markup from being rendered as HTML.
  const delivery = await fetcher('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.CONTACT_FROM, to: [env.CONTACT_TO], reply_to: data.email, subject: 'Website project inquiry', text }),
    signal: AbortSignal.timeout(10000)
  });
  if (!delivery.ok) throw new HttpError(502, 'We could not send your request. Please try again or call (877) 266-7379.');
  const sent = await delivery.json();
  if (typeof sent.id !== 'string' || !sent.id) throw new HttpError(502, 'We could not confirm your request. Please call (877) 266-7379.');
  // Provider acceptance is not proof of inbox delivery. Do not return provider data.
  return json(200, { ok: true });
}

export async function handleRequest(request, env, fetcher = fetch) {
  const url = new URL(request.url);
  try {
    if (url.pathname === '/api/contact/config') {
      if (request.method !== 'GET') return json(405, { error: 'Method not allowed.' }, { Allow: 'GET' });
      const available = Boolean(enabled(env) && origins(env).includes(url.origin));
      return json(200, { enabled: available, siteKey: available ? env.TURNSTILE_SITE_KEY : null });
    }
    if (url.pathname === '/api/contact') return await contact(request, env, fetcher);
    if (url.pathname.startsWith('/api/')) return json(404, { error: 'Not found.' });
    return await env.ASSETS.fetch(request);
  } catch (error) {
    if (error instanceof HttpError) return json(error.status, { error: error.message });
    // Never expose or log submitted content, secrets, or upstream response bodies.
    return json(503, { error: 'Online requests are temporarily unavailable. Please try again or call (877) 266-7379.' });
  }
}

export default { fetch: (request, env) => handleRequest(request, env) };
