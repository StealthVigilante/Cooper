import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { handleRequest } from '../worker/index.mjs';

const origin = 'https://cooper.enhanzsolutions.com';
function environment(overrides = {}) {
  return { CONTACT_ENABLED: 'true', RESEND_API_KEY: 'test-secret', TURNSTILE_SECRET_KEY: 'test-turnstile-secret',
    TURNSTILE_SITE_KEY: 'public-key', CONTACT_FROM: 'Website <projects@notify.cooper.test>',
    CONTACT_TO: 'owner@cooper.test', ALLOWED_ORIGINS: origin,
    CONTACT_RATE_LIMITER: { limit: async () => ({ success: true }) },
    CONTACT_SEND_LIMITER: { limit: async () => ({ success: true }) }, ...overrides };
}
function fields() {
  return new URLSearchParams({ name: 'Jane Example', email: 'jane@example.net', town: 'Alpha', type: 'Residential',
    systems: 'Surveillance', stage: 'Existing home or building', timing: 'Within three months',
    phone: '+1 555 555 0100', message: 'Please discuss a project.', website: '', 'cf-turnstile-response': 'token' });
}
function request(form = fields(), headers = {}) {
  return new Request(`${origin}/api/contact`, { method: 'POST', body: form, headers: { Origin: origin, 'CF-Connecting-IP': '192.0.2.1', ...headers } });
}
function provider(verify = {}, delivery = { id: 'test-id' }) {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, ...init });
    return Response.json(url.includes('siteverify') ? { success: true, action: 'contact', hostname: 'cooper.enhanzsolutions.com', ...verify } : delivery);
  };
  return { calls, fetcher };
}
const neverFetch = async () => { assert.fail('No external service should be called'); };

test('sends one plain-text inquiry to the fixed inbox with a visitor Reply-To', async () => {
  const { calls, fetcher } = provider();
  const response = await handleRequest(request(), environment(), fetcher);
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true });
  assert.equal(calls.length, 2);
  const email = JSON.parse(calls[1].body);
  assert.deepEqual(email.to, ['owner@cooper.test']); assert.equal(email.reply_to, 'jane@example.net');
  assert.equal(email.subject, 'Website project inquiry'); assert.equal(email.html, undefined);
  assert.match(email.text, /Town \/ city: Alpha/);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
});
test('accepts multipart browser submissions and treats markup as plain text', async () => {
  const data = new FormData(); for (const [key, value] of fields()) data.append(key, value);
  data.set('message', '<img src=x onerror=alert(1)>');
  const { calls, fetcher } = provider();
  assert.equal((await handleRequest(request(data), environment(), fetcher)).status, 200);
  assert.match(JSON.parse(calls[1].body).text, /<img src=x/);
  assert.equal(JSON.parse(calls[1].body).html, undefined);
});
for (const badOrigin of ['https://evil.test', 'null', '']) {
  test(`rejects browser submissions with Origin ${JSON.stringify(badOrigin)}`, async () => {
    assert.equal((await handleRequest(request(fields(), { Origin: badOrigin }), environment(), neverFetch)).status, 403);
  });
}
test('rejects same-origin headers on a host outside the allowlist', async () => {
  assert.equal((await handleRequest(request(), environment({ ALLOWED_ORIGINS: 'https://other.test' }), neverFetch)).status, 403);
});
test('rejects cross-site fetch metadata', async () => {
  assert.equal((await handleRequest(request(fields(), { 'Sec-Fetch-Site': 'cross-site' }), environment(), neverFetch)).status, 403);
});
for (const overrides of [{ CONTACT_ENABLED: 'false' }, { RESEND_API_KEY: '' }, { TURNSTILE_SECRET_KEY: '' },
  { CONTACT_RATE_LIMITER: undefined }, { CONTACT_SEND_LIMITER: undefined },
  { CONTACT_TO: 'replace-with-receiving-inbox@example.com' }, { TURNSTILE_SITE_KEY: 'REPLACE_WITH_PUBLIC_SITE_KEY' }]) {
  test(`fails closed for unavailable configuration: ${Object.keys(overrides)[0]}`, async () => {
    assert.equal((await handleRequest(request(), environment(overrides), neverFetch)).status, 503);
  });
}
test('does not trust forwarded headers instead of Cloudflare client IP', async () => {
  const req = request(); req.headers.delete('CF-Connecting-IP'); req.headers.set('X-Forwarded-For', '192.0.2.2');
  assert.equal((await handleRequest(req, environment(), neverFetch)).status, 503);
});
test('rate limits before processing the submission', async () => {
  const env = environment({ CONTACT_RATE_LIMITER: { limit: async ({ key }) => { assert.equal(key, 'contact:192.0.2.1'); return { success: false }; } } });
  const response = await handleRequest(request(), env, neverFetch);
  assert.equal(response.status, 429); assert.equal(response.headers.get('Retry-After'), '60');
});
test('a rate limiter outage cannot bypass protection', async () => {
  const env = environment({ CONTACT_RATE_LIMITER: { limit: async () => { throw Error('private details'); } } });
  const response = await handleRequest(request(), env, neverFetch);
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private details/);
});
test('rejects unsupported content types', async () => {
  const response = await handleRequest(request('{}', { 'Content-Type': 'application/json' }), environment(), neverFetch);
  assert.equal(response.status, 415);
});
test('caps declared payload sizes', async () => {
  assert.equal((await handleRequest(request(fields(), { 'Content-Length': '999999' }), environment(), neverFetch)).status, 413);
});
test('caps actual payloads even without Content-Length', async () => {
  const data = fields(); data.set('message', 'a'.repeat(25000));
  const req = request(data); req.headers.delete('Content-Length');
  assert.equal((await handleRequest(req, environment(), neverFetch)).status, 413);
});
for (const [label, mutate] of [
  ['missing required data', d => d.delete('name')],
  ['whitespace required data', d => d.set('town', '   ')],
  ['email header injection', d => d.set('email', 'person@example.net\r\nBcc:other@example.net')],
  ['invalid email', d => d.set('email', 'invalid')],
  ['long messages', d => d.set('message', 'a'.repeat(4001))],
  ['unknown fields / arbitrary recipients', d => d.set('to', 'attacker@example.net')],
  ['duplicate scalar values', d => d.append('email', 'other@example.net')],
  ['unknown project type', d => d.set('type', 'Other')],
  ['unknown systems', d => d.set('systems', 'Other')],
  ['duplicate systems', d => d.append('systems', 'Surveillance')],
  ['honeypot content', d => d.set('website', 'https://spam.example')],
  ['missing challenge token', d => d.delete('cf-turnstile-response')]
]) {
  test(`rejects ${label}`, async () => {
    const data = fields(); mutate(data);
    assert.equal((await handleRequest(request(data), environment(), neverFetch)).status, 400);
  });
}
test('rejects uploads masquerading as form fields', async () => {
  const data = new FormData(); for (const [key, value] of fields()) data.append(key, value);
  data.set('name', new Blob(['file']), 'file.txt');
  assert.equal((await handleRequest(request(data), environment(), neverFetch)).status, 400);
});
for (const result of [{ success: false }, { action: 'another-form' }, { hostname: 'evil.test' }]) {
  test(`rejects failed, replayed or incorrectly scoped Turnstile results: ${JSON.stringify(result)}`, async () => {
    const { calls, fetcher } = provider(result);
    assert.equal((await handleRequest(request(), environment(), fetcher)).status, 400);
    assert.equal(calls.length, 1);
  });
}
test('Turnstile network failure prevents any email', async () => {
  let count = 0;
  const response = await handleRequest(request(), environment(), async () => { count++; throw Error('SECRET'); });
  assert.equal(response.status, 503); assert.equal(count, 1); assert.doesNotMatch(await response.text(), /SECRET/);
});
test('the shared sending limiter blocks delivery after a valid challenge', async () => {
  const { calls, fetcher } = provider();
  const env = environment({ CONTACT_SEND_LIMITER: { limit: async () => ({ success: false }) } });
  assert.equal((await handleRequest(request(), env, fetcher)).status, 429); assert.equal(calls.length, 1);
});
test('Resend failures never produce success or expose provider errors', async () => {
  const response = await handleRequest(request(), environment(), async url => url.includes('siteverify')
    ? Response.json({ success: true, hostname: 'cooper.enhanzsolutions.com', action: 'contact' })
    : Response.json({ error: 'secret upstream error' }, { status: 403 }));
  assert.equal(response.status, 502); assert.doesNotMatch(await response.text(), /secret upstream error/);
});
test('malformed provider success responses never produce false success', async () => {
  const { fetcher } = provider({}, {});
  assert.equal((await handleRequest(request(), environment(), fetcher)).status, 502);
});
test('public config exposes only availability and the public site key', async () => {
  const response = await handleRequest(new Request(`${origin}/api/contact/config`), environment(), neverFetch);
  assert.deepEqual(await response.json(), { enabled: true, siteKey: 'public-key' });
  const disabled = await handleRequest(new Request(`${origin}/api/contact/config`), environment({ CONTACT_ENABLED: 'false' }), neverFetch);
  assert.deepEqual(await disabled.json(), { enabled: false, siteKey: null });
});
test('unknown API routes and unsupported methods have accurate status codes', async () => {
  assert.equal((await handleRequest(new Request(`${origin}/api/contact`), environment(), neverFetch)).status, 405);
  assert.equal((await handleRequest(new Request(`${origin}/api/missing`), environment(), neverFetch)).status, 404);
});
test('the Cloudflare entry point handles its execution context correctly', async () => {
  const response = await worker.fetch(new Request(`${origin}/api/contact/config`), environment(), { waitUntil() {} });
  assert.equal(response.status, 200);
});
