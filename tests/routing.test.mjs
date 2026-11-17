import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleRequest } from '../worker/index.mjs';

const hostname = 'coopertechnologygroup.com';
const origin = `https://${hostname}`;
const forbiddenHosts = ['cooper.enhanzsolutions.com', 'cooper-landing-page.mailing-b99.workers.dev', 'test.coopertechnologygroup.com', 'www.coopertechnologygroup.com', 'evil.test', 'coopertechnologygroup.com.evil.test'];
const paths = ['/', '/contact.html', '/index.html', '/404.html', '/assets/css/main.css', '/assets/js/main.js', '/assets/fonts/fonts.css', '/assets/img/logo-symbols.svg', '/robots.txt', '/sitemap.xml', '/api/contact/config', '/api/contact', '/missing/nested/page'];

function env(overrides = {}) {
  return {
    ALLOWED_HOSTS: hostname,
    ASSETS: { fetch: async () => { assert.fail('Denied requests must not reach assets'); } },
    ...overrides
  };
}
const neverFetch = async () => { assert.fail('Denied requests must not call providers'); };

for (const host of forbiddenHosts) {
  test(`rejects every path and method on ${host} before serving assets or APIs`, async () => {
    for (const path of paths) {
      for (const method of ['GET', 'HEAD', 'POST', 'OPTIONS']) {
        const response = await handleRequest(new Request(`https://${host}${path}`, { method }), env(), neverFetch);
        assert.equal(response.status, 403, `${method} ${path}`);
        assert.equal(response.headers.get('Cache-Control'), 'no-store');
        assert.equal(response.headers.get('X-Robots-Tag'), 'noindex');
        assert.equal(await response.text(), method === 'HEAD' ? '' : 'Forbidden');
      }
    }
  });
}

test('a missing or empty hostname allowlist denies requests', async () => {
  for (const ALLOWED_HOSTS of [undefined, '', '   ']) {
    const response = await handleRequest(new Request(origin), env({ ALLOWED_HOSTS }), neverFetch);
    assert.equal(response.status, 403);
  }
});

test('spoofed Host and forwarding headers cannot bypass the URL hostname check', async () => {
  const response = await handleRequest(new Request('https://cooper.enhanzsolutions.com/assets/css/main.css', {
    headers: { Host: hostname, 'X-Forwarded-Host': hostname, Forwarded: `host=${hostname}` }
  }), env(), neverFetch);
  assert.equal(response.status, 403);
});

test('allowed pages and assets keep their original request and cache/security headers', async () => {
  for (const path of ['/', '/contact.html', '/assets/css/main.css', '/assets/img/logo-symbols.svg']) {
    const request = new Request(origin + path);
    const response = await handleRequest(request, env({ ASSETS: { fetch: async received => {
      assert.equal(received, request);
      return new Response('asset', { headers: { 'Cache-Control': 'public, max-age=86400', ETag: 'asset-version', 'X-Content-Type-Options': 'nosniff' } });
    } } }), neverFetch);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'asset');
    assert.equal(response.headers.get('Cache-Control'), 'public, max-age=86400');
    assert.equal(response.headers.get('ETag'), 'asset-version');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  }
});

test('the hostname allowlist matches exact names and permits explicitly configured future hosts', async () => {
  const configured = env({ ALLOWED_HOSTS: ` ${hostname.toUpperCase()}, www.coopertechnologygroup.com ` });
  const response = await handleRequest(new Request('https://www.coopertechnologygroup.com/api/contact/config'), configured, neverFetch);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { enabled: false, siteKey: null });
  assert.equal((await handleRequest(new Request(`https://${hostname}./`), configured, neverFetch)).status, 403);
});

test('missing pages retain a 404 body/status and cannot be indexed or cached', async () => {
  const response = await handleRequest(new Request(`${origin}/missing/nested/page`), env({ ASSETS: {
    fetch: async () => new Response('<h1>Page not found</h1>', { status: 404, headers: { 'Content-Type': 'text/html', 'X-Content-Type-Options': 'nosniff' } })
  } }), neverFetch);
  assert.equal(response.status, 404);
  assert.match(await response.text(), /Page not found/);
  assert.equal(response.headers.get('Content-Type'), 'text/html');
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
});

test('direct requests to 404.html also return an actual 404', async () => {
  const response = await handleRequest(new Request(`${origin}/404.html`), env({ ASSETS: {
    fetch: async () => new Response('<h1>Page not found</h1>')
  } }), neverFetch);
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex');
});

test('production routing sends every request through the hostname guard', () => {
  const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').split('\n').filter(line => !line.trimStart().startsWith('//')).join('\n'));
  assert.equal(config.assets.run_worker_first, true);
  assert.equal(config.assets.directory, './dist');
  assert.equal(config.assets.not_found_handling, '404-page');
  assert.equal(config.vars.ALLOWED_HOSTS, hostname);
  assert.equal(config.vars.ALLOWED_ORIGINS, origin);
  const site = JSON.parse(readFileSync('site.config.json', 'utf8'));
  assert.equal(site.productionOrigin, origin);
  assert.equal(site.productionReady, true);
  const sitemap = readFileSync('sitemap.xml', 'utf8');
  assert.doesNotMatch(sitemap, /404\.html/);
});
