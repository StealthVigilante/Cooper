import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { securityHeaders } from '../worker/security.mjs';

// Only this explicit allowlist is published. Secrets, source, tests, reports,
// dependencies and dotfiles can never become Worker static assets.
// A fresh output directory also removes files deleted since an earlier build.
import { rm } from 'node:fs/promises';
await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('assets', 'dist/assets', { recursive: true });
const files = (await readdir('.')).filter(name => name.endsWith('.html'));
const config = JSON.parse(await readFile('site.config.json', 'utf8'));
const siteURL = (process.env.SITE_URL || config.productionOrigin).replace(/\/$/, '');
const parsed = new URL(siteURL);
if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) throw new Error('SITE_URL must be an HTTPS origin.');
if (config.productionReady && parsed.hostname.endsWith('.example')) throw new Error('Replace the final-domain placeholder before enabling production indexing.');
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const licenses = config.businessLicenses.filter(l => l.number && l.holder && !/REPLACE_WITH/.test(l.number + l.holder));
const licenseHTML = licenses.length ? `<div class="footer__licenses small">${licenses.map(l => `<p>${escape(l.label)}: ${escape(l.number)} · ${escape(l.holder)}</p>`).join('')}</div>` : '';
for (const name of [...files, 'robots.txt', 'sitemap.xml']) {
  let content = (await readFile(name, 'utf8')).replaceAll('https://coopertechnologygroup.com', siteURL);
  content = content.replace('<!-- BUSINESS_LICENSES -->', licenseHTML);
  await writeFile(`dist/${name}`, content);
}

// Static asset headers do not apply to Worker-generated API responses; the
// Worker attaches the same security headers itself.
const common = Object.entries(securityHeaders).map(([key, value]) => `  ${key}: ${value}`).join('\n') + (config.productionReady ? '' : '\n  X-Robots-Tag: noindex, nofollow');
const headers = `/*\n${common}\n\n/assets/css/*\n  Cache-Control: public, max-age=86400\n\n/assets/js/*\n  Cache-Control: public, max-age=86400\n\n/assets/img/*\n  Cache-Control: public, max-age=86400\n\n/assets/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/assets/vendor/*\n  Cache-Control: public, max-age=31536000, immutable\n\nhttps://cooper.enhanzsolutions.com/*\n  X-Robots-Tag: noindex, nofollow\n\nhttps://:worker.:account.workers.dev/*\n  X-Robots-Tag: noindex, nofollow\n`;
await writeFile('dist/_headers', headers);
await writeFile('dist/_redirects', '/ /index.html 200\n/index.html / 301\n');
console.log(`Built ${files.length} pages for ${siteURL}. Indexing: ${config.productionReady ? 'production only' : 'disabled (preview)'}. Email activation is configured separately.`);
