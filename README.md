# Cooper Technology Group website

Static HTML/CSS/JavaScript with a Cloudflare Worker for the project inquiry form. Email is delivered through Resend. This repository now includes privacy and website terms pages, form protections, a safe asset build, security headers, and local fonts/libraries.

**Current state:** prepared and tested locally, not deployed by this change. The form is deliberately disabled, final-domain details are placeholders, and search indexing is disabled. Existing hosting remains unchanged until you deploy.

## Fill these in later

| Detail | Where to put it | Current placeholder / action |
| --- | --- | --- |
| Final website domain | `site.config.json` → `productionOrigin` | `https://replace-with-final-domain.example` |
| Search indexing | `site.config.json` → `productionReady` | Keep `false` while on the temporary domain; set `true` only for launch |
| Existing Cloudflare Worker name | `wrangler.jsonc` → `name` | Replace `cooper-technology-group` with the actual existing Worker name before deployment |
| Website origins allowed to submit | `wrangler.jsonc` → `vars.ALLOWED_ORIGINS` | Temporary host is included. Replace the final-domain placeholder; include the exact `https://` origin, no trailing slash; add `www` only if used |
| Email sender | `wrangler.jsonc` → `vars.CONTACT_FROM` | `Cooper Website <projects@replace-with-sending-domain.example>`; must use your verified Resend sending domain |
| Receiving inbox | `wrangler.jsonc` → `vars.CONTACT_TO` | `replace-with-receiving-inbox@example.com`; use one real inbox |
| Public Turnstile site key | `wrangler.jsonc` → `vars.TURNSTILE_SITE_KEY` | `REPLACE_WITH_PUBLIC_SITE_KEY` |
| Resend API key | Cloudflare secret `RESEND_API_KEY` | Set securely; never paste into HTML, configuration committed to Git, or chat |
| Turnstile secret | Cloudflare secret `TURNSTILE_SECRET_KEY` | Set securely; the public site key is a different value |
| Activate the form | `wrangler.jsonc` → `vars.CONTACT_ENABLED` | Change `"false"` to `"true"` after the above values are ready |
| NJ qualifying individual license | `site.config.json` → `businessLicenses` | Replace with the verified licensee's name and individual license number as required |
| NJ burglar alarm business license | `site.config.json` → `businessLicenses` | Replace the holder/name and number with verified current details |
| NJ fire alarm business license | Same | Replace with verified current details if advertising these services |
| NJ home improvement business registration | Same | Confirm whether required for the actual work/business; replace if applicable |
| PA home improvement contractor registration | Same | Confirm applicability/exemptions; replace if applicable |

The builder omits incomplete license entries from public pages. Delete entries that genuinely do not apply; do not invent numbers or describe a registration as a license. Completed entries are displayed in the footer on every page. Placeholders are reminders, **not a substitute for required advertising disclosures**. The form also rejects placeholder settings even if someone flips its enabled switch too early.

Temporary website: <https://cooper.enhanzsolutions.com/>. This hostname always receives `X-Robots-Tag: noindex, nofollow`, even after production indexing is enabled. Worker preview hostnames are also excluded. Leave `productionReady: false` for any other preview hostname until launch. For separate production and preview Workers, keep separate Wrangler/site configurations so a preview rebuild cannot change live settings.

## Local development and checks

Use Node.js 22.8 or newer.

```sh
npm ci
npm test
npm run build
npm run dev
```

Open the local address printed by Wrangler, normally `http://localhost:8787`. The disabled form shows a phone-contact message rather than pretending to send anything.

For local email configuration, copy `.dev.vars.example` to `.dev.vars` and fill it in privately. Use a dedicated test inbox; enabling a real Resend key can send real messages. Set `ALLOWED_ORIGINS` to the exact local origin you use. Turnstile test keys work locally; a real widget must allow the real website hostname. The Worker verifies both `hostname` and `action: contact`, so local tests must use a result scoped to the local hostname. Do not weaken production verification to accommodate test keys.

Browser checks:

```sh
npx playwright install chromium
npm run test:browser
```

If Chromium is already installed, you can set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path instead. Browser tests mock Turnstile and email API results; they do not send live email. The suite checks real Worker asset routing/headers, form validation and success/failure states, local assets, mobile navigation, and the JavaScript-disabled fallback.

`npm run check` runs tests, builds, and runs `wrangler deploy --dry-run`. The dry run validates the bundle and bindings without publishing. `dist/`, local secrets, dependencies and test output are ignored by Git.

## Set up Resend

1. In your existing Resend account, add a sending domain you control. A subdomain such as `notify.YOUR-DOMAIN` keeps website mail separate from regular business mail. The sending domain and website domain may differ if both are configured correctly.
2. Add the **exact DNS records provided by Resend** for that domain/subdomain and wait for verified status. Follow its SPF, DKIM and return-path instructions. Do not replace your normal business-mail MX records or create a second SPF TXT record at an existing SPF hostname. If Cloudflare DNS offers proxying for these records, use DNS-only as Resend instructs.
3. Check the domain's existing DMARC policy and alignment. Start with monitoring if there is no policy and audit all legitimate senders before enforcing rejection. Keep email open/click tracking off for these private inquiry notifications. Resend verification authenticates sending; it does not create a mailbox.
4. Create a **sending-only API key restricted to that verified sending domain**. Do not use a full-account management key for the form.
5. Fill `CONTACT_FROM` with an address at the verified domain and `CONTACT_TO` with the owner's receiving inbox. The visitor's validated email becomes `Reply-To`; it is never used as the sender or recipient. The form sends only an internal notification, with no automatic reply, subscription, or marketing enrollment.
6. Store the key as a Cloudflare Worker secret through its dashboard, or use Wrangler's interactive prompt:

```sh
npx wrangler secret put RESEND_API_KEY
```

Set the correct existing Worker name first. The command modifies that Worker's secrets; coordinate with the intended deployment. Do not put the key on the command line. If the Worker does not exist yet, create/deploy it with sending disabled before configuring secrets.

Official references: [domain verification](https://resend.com/docs/dashboard/domains/introduction), [API keys](https://resend.com/docs/dashboard/api-keys/introduction), [sending API](https://resend.com/docs/api-reference/emails/send-email).

## Set up spam protection and limits

1. Create a Cloudflare Turnstile managed widget. Allow `cooper.enhanzsolutions.com` for preview and the final hostname(s) when known. Keep pre-clearance disabled unless you deliberately need it.
2. Put its public key in `TURNSTILE_SITE_KEY`. Store its secret in Cloudflare:

```sh
npx wrangler secret put TURNSTILE_SECRET_KEY
```

3. Confirm `ALLOWED_ORIGINS` matches the website origin. The front end and `/api/contact` live on the same Worker origin; there is no permissive cross-origin API.
4. The Worker checks Cloudflare's client-IP header and allows approximately **5 submission attempts per IP per minute**, plus **20 verified send attempts per minute per Cloudflare location**. Keep the two rate-limit namespace IDs unique within your Cloudflare account if other Workers already use those numbers. Both bindings are required; failures do not bypass protection.
5. Cloudflare's binding limits are approximate and local to a data center, **not a global daily quota or billing cap**. Monitor your Resend usage and plan limits, enable account alerts where available, and use stricter centralized limits if traffic warrants them. An additional edge/WAF rate rule can reduce abusive requests before Worker execution if available on your plan; challenge/limit the API, not normal browsing or search crawlers.

The server also checks origin, field values and lengths, request body size (24 KiB), a honeypot, allowed project selections, and Turnstile validity/hostname/action. No attachments are accepted. Submitted content goes into plain text, not HTML. Provider requests have timeouts. Errors preserve entered form data; a successful HTTP response is insufficient unless the JSON explicitly confirms success.

Official references: [rate-limit behavior](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [server-side Turnstile validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

## Minimal legal work before launch

See [the researched assessment](docs/REVIEW.md) for sources and rationale. Practical minimum for this NJ/PA service-business inquiry website:

- Review `privacy.html` so its description matches the owner's actual handling of inquiries, mailbox access and retention. It covers Cloudflare, Turnstile, Resend, the business inbox, technical data, contact/correction/deletion requests and updates. The phone and postal address are used because a privacy email address has not been confirmed.
- Keep the footer privacy link and brief form notice. The form warns visitors not to send alarm codes, passwords or sensitive security details, and directs emergencies to 911.
- Keep `terms.html` brief: informational website, separate service/monitoring agreement, system limitations, responsible use and contact details. These are website terms, not a replacement for actual installation/monitoring contracts and not a guarantee against lawsuits.
- Verify and publish the relevant business license/registration numbers and holder names. This can be an advertising requirement, and is a higher priority than adding lengthy generic terms.
- Confirm ownership/licensing for photos, logo and copy, and accuracy/permission for the “real calls” stories, 40+ years claim, 24/7 monitoring claim, service areas, address and other objective claims. Local font/library license notices are included in `assets/`.
- Decide how long unsuccessful inquiries should be kept and periodically delete those no longer needed, including in the business mailbox/provider settings. Restrict mailbox/account access and use MFA. The notice does not invent an automatic deletion deadline.
- Keep the contact form and main navigation keyboard accessible. Do not claim legal or WCAG certification from these checks.

No advertising/analytics tools were found in the supplied site. A broad cookie banner is not added to this configuration. Reassess privacy/consent requirements if you later add analytics, remarketing pixels, embedded maps/video, visitor recording, newsletters or SMS marketing. Merely having one owner does not by itself exempt a business from applicable laws. Legal conclusions remain conditional on actual business practices and customer locations.

## Deploy when ready

1. Set the existing Worker name and account/route/domain details. Preserve existing routes/settings that are managed outside this repository; none were supplied here. This configuration does not attach or move any domain by itself.
2. Configure the secrets and public variables above. Set `CONTACT_ENABLED: "true"` only when real values are in place. Keep the temporary site unindexed.
3. Run `npm run check`, then deploy the prepared Worker and its assets with `npm run deploy` when you intend to publish. For Workers Builds, use `npm ci && npm run build` as the build step and `npx wrangler deploy` as the deploy step. Do not upload the entire repository as static assets; only `dist/` is public, and the Worker is necessary for the form.
4. On the deployed preview, verify `/api/contact/config` reports enabled, complete a real Turnstile challenge, and submit a single controlled inquiry. Confirm the success screen, Resend delivery status, inbox/spam arrival and Reply-To. Provider acceptance is not proof of inbox delivery. Check that a failed submission keeps its contents. No live email has been sent by the automated tests.
5. Before the final-domain launch, set `productionOrigin`, replace license placeholders as applicable, check all legal/owner details, add the final Turnstile hostname and allowed origin, and attach the final custom domain in Cloudflare. Set `productionReady: true` and rebuild/deploy. If DNS is managed elsewhere, use the records Cloudflare supplies; do not guess them.
6. Verify HTTP→HTTPS and preferred-host redirects at Cloudflare. Check canonical tags, social images, JSON-LD, robots/sitemap URLs and the final response headers. The source uses the old business domain as a template; **the build rewrites it to `productionOrigin` throughout metadata, schema, sitemap and robots**. Always deploy the build output.
7. Submit the final sitemap in Google Search Console, confirm your Google Business Profile details, and measure mobile Core Web Vitals on the final deployment. The preview should remain noindex, and should not be disallowed in robots.txt in a way that prevents crawlers from seeing that header.

## Maintenance

- Review Cloudflare/Resend usage and delivery failures periodically. To stop online submissions quickly, set `CONTACT_ENABLED: "false"` in the active Worker configuration and redeploy if using file-managed variables; phone contact remains available.
- Rotate any exposed secrets; keep Cloudflare, Resend and the receiving mailbox protected with MFA.
- Run `npm audit` and review dependency upgrades periodically. There are no production npm dependencies; Wrangler/Playwright are pinned development tools. Vendored Lenis is separate from npm audit, so review its upstream notices too.
- CSS, JS and images cache for one day; update their `?v=` URL when changing them. Fonts/vendor files use long-lived immutable caching; change filenames when replacing them. HTML revalidates on navigation.
- Recheck legal copy, disclosures and privacy practices when services, processors, tracking, geography or data collection change.
