import { test, expect } from '@playwright/test';
import { readdir } from 'node:fs/promises';

test('all pages render with security headers, images, local fonts and legal links', async ({ page }) => {
  const errors = [];
  const violations = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.cspErrors = [];
    document.addEventListener('securitypolicyviolation', e => window.cspErrors.push(e.violatedDirective + ': ' + e.blockedURI));
  });
  for (const name of (await readdir('dist')).filter(n => n.endsWith('.html'))) {
    const response = await page.goto(name === 'index.html' ? '/' : `/${name}`);
    expect(response.status(), name).toBe(200);
    expect(response.headers()['content-security-policy'], name).toContain("script-src-attr 'none'");
    expect(response.headers()['x-robots-tag'], name).toContain('noindex');
    await expect(page.locator('h1'), name).toBeVisible();
    await expect(page.locator('footer a[href="privacy.html"]')).toBeVisible();
    await expect(page.locator('footer a[href="terms.html"]')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.fonts.check('16px "Schibsted Grotesk"'))).toBe(true);
    expect(await page.locator('.brand use').first().evaluate(el => el.getBBox().width)).toBeGreaterThan(0);
    await page.locator('footer').scrollIntoViewIfNeeded();
    expect(await page.locator('img').evaluateAll(images => images.filter(i => i.complete && i.naturalWidth === 0).map(i => i.src))).toEqual([]);
    violations.push(...await page.evaluate(() => window.cspErrors));
  }
  expect(errors).toEqual([]);
  expect(violations).toEqual([]);
});

test('private source/configuration and nonexistent pages are not served', async ({ request }) => {
  for (const path of ['/.dev.vars', '/worker/index.mjs', '/wrangler.jsonc', '/site.config.json', '/package.json', '/README.md', '/.git/config', '/missing-page.html']) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
  const redirect = await request.get('/index.html', { maxRedirects: 0 });
  expect(redirect.status()).toBe(301);
  expect(redirect.headers().location).toBe('/');
});

test('unconfigured form clearly offers phone contact and cannot pretend to send', async ({ page }) => {
  await page.goto('/contact.html');
  await expect(page.getByRole('button', { name: 'Send project details' })).toBeDisabled();
  await expect(page.locator('#form-status')).toContainText('Online requests are currently unavailable');
  expect(await page.evaluate(() => performance.getEntriesByType('resource').some(r => r.name.includes('challenges.cloudflare.com')))).toBe(false);
});

async function enableForm(page) {
  await page.route('**/api/contact/config', route => route.fulfill({ json: { enabled: true, siteKey: 'public-test-key' } }));
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', route => route.fulfill({ contentType: 'application/javascript', body: `window.turnstile = { render: function(selector, options) { window.challengeOptions = options; setTimeout(function(){options.callback('test-token')}, 0); return 'test-widget'; }, reset: function() { setTimeout(function(){window.challengeOptions.callback('new-test-token')}, 0); } };` }));
  await page.goto('/contact.html');
  await expect(page.getByRole('button', { name: 'Send project details' })).toBeEnabled();
  await page.getByLabel('Full name (required)').fill('Jane Example');
  await page.getByLabel('Email (required)').fill('jane@example.net');
  await page.getByLabel('Town or city (required)').fill('Alpha');
  await page.getByLabel('About the project', { exact: true }).fill('<b>My project</b>');
}

test('form validates, sends once and only resets after confirmed API success', async ({ page }) => {
  let sends = 0;
  await page.route('**/api/contact', async route => {
    sends++;
    const body = route.request().postData();
    expect(body).toContain('test-token');
    await route.fulfill({ json: { ok: true } });
  });
  await enableForm(page);
  await page.getByLabel('Email (required)').fill('invalid');
  await page.getByRole('button', { name: 'Send project details' }).click();
  await expect(page.getByLabel('Email (required)')).toBeFocused();
  expect(sends).toBe(0);
  await page.getByLabel('Email (required)').fill('jane@example.net');
  await page.getByRole('button', { name: 'Send project details' }).click();
  await expect(page.locator('#form-status')).toContainText('Your request has been sent');
  await expect(page.getByLabel('Full name (required)')).toHaveValue('');
  expect(sends).toBe(1);
});

test('failed requests preserve user input and show rate-limit feedback', async ({ page }) => {
  await page.route('**/api/contact', route => route.fulfill({ status: 429, json: { error: 'Too many attempts. Wait a minute or call (877) 266-7379.' } }));
  await enableForm(page);
  await page.getByRole('button', { name: 'Send project details' }).click();
  await expect(page.locator('#form-status')).toContainText('Too many attempts');
  await expect(page.getByLabel('Full name (required)')).toHaveValue('Jane Example');
  await expect(page.getByLabel('About the project', { exact: true })).toHaveValue('<b>My project</b>');
  await expect(page.locator('#form-status b')).toHaveCount(0);
});

test('HTML fallback responses cannot be mistaken for successful submission', async ({ page }) => {
  await page.route('**/api/contact', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<html>Wrong route</html>' }));
  await enableForm(page);
  await page.getByRole('button', { name: 'Send project details' }).click();
  await expect(page.locator('#form-status')).toContainText('We could not confirm');
  await expect(page.getByLabel('Full name (required)')).toHaveValue('Jane Example');
});

test('mobile layout, navigation and legal content remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.locator('#menu')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('main')).toHaveAttribute('inert', '');
  await page.locator('#menu .btn').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('main')).not.toHaveAttribute('inert');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect(page.locator('main')).not.toHaveAttribute('inert');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('main')).not.toHaveAttribute('inert');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/privacy.html');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: '/tmp/cooper-privacy-mobile.png', fullPage: true });
});

test('content recovers if animation JavaScript fails to load', async ({ page }) => {
  await page.route('**/assets/js/main.js*', route => route.abort());
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveClass(/\bjs\b/, { timeout: 8000 });
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('.hero__copy')).toHaveCSS('opacity', '1');
});

test('content and a phone fallback remain available without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:8787/contact.html');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('noscript p')).toBeVisible();
  await expect(page.locator('noscript p')).toContainText('Please call');
  await context.close();
});
