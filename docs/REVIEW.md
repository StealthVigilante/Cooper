# Website review — November 13, 2026

Scope: supplied repository, its new Worker integration, and a read-only check of the temporary deployment at `https://cooper.enhanzsolutions.com/`. The user confirmed this is Cooper Technology Group in Alpha, NJ, serving NJ and PA. The final domain, recipient inbox and license numbers are not yet supplied; placeholders and exact setup steps are in [README.md](../README.md).

## Minimum legal recommendation

For this informational service-business site with an inquiry form, use a short, accurate privacy policy, a notice beside the form, brief website terms, and verified business disclosures. Extensive account, checkout, subscription, arbitration and refund terms are not appropriate to functionality that does not exist here. No website document guarantees immunity from a claim. This assessment identifies practical website actions; it does not validate the owner's business licensing, contracts, insurance or offline practices.

| Item | Assessment and action |
| --- | --- |
| License/registration advertising disclosures | **Highest unresolved legal item.** No license numbers appeared in the supplied pages. NJ's alarm advertising rule includes internet advertising and requires licensee identification, applicable business license information, address and phone. Obtain actual current numbers/holder names before advertising regulated services; use the configuration to render them throughout the site. [N.J.A.C. 13:31A-1.13](https://www.law.cornell.edu/regulations/new-jersey/N-J-A-C-13-31A-1-13) |
| PA home improvement registration | Security-system installation is expressly included in PA's home improvement guidance. Registration/advertising-number rules can apply to residential work, subject to exemptions and the actual business activity. Confirm the owner's registration status; one person is not automatically exempt. [PA Attorney General FAQ](https://www.attorneygeneral.gov/businesses-and-organizations/home-improvement-contractor-registration/frequently-asked-questions/) |
| NJ home improvement registration | Confirm whether the work requires this registration or is covered by an applicable licensed-professional exemption; do not assume both alarm licensing and a separate registration are always required. NJ guidance requires applicable registration numbers in advertising. [NJ Consumer Affairs FAQ](https://www.njconsumeraffairs.gov/hic/Pages/FAQ.aspx) |
| Privacy notice | Added `privacy.html` and footer/form links. It explains collected fields, Cloudflare/Turnstile, Resend/email processing, purpose, retention, contact requests and tracking. It should match actual mailbox/provider handling. Broader state-law applicability cannot be settled solely by the number of staff. |
| NJ privacy-law threshold | The NJ statute generally covers processing 100,000 consumers' data per year, or 25,000 while earning revenue/discounts from personal-data sales. A small local inquiry site may fall below this, **an inference pending actual processing volumes and practices**, not a verified exemption. Even below those thresholds, accurate privacy representations and sensible data handling remain necessary. [Enacted NJ privacy statute](https://pub.njleg.state.nj.us/Bills/2022/PL23/266_.HTM) |
| Other visitors | CalOPPA can require a privacy policy when a commercial site collects personally identifiable information from California consumers; it is separate from the higher-threshold CCPA regime. The policy is a practical default for this public website. A US-only local offering does not by itself establish GDPR territorial scope; reassess if intentionally targeting or monitoring people elsewhere. [California AG notice describing CalOPPA scope](https://oag.ca.gov/system/files/attachments/press_releases/CalOPPA%20Letter_0.pdf) |
| Website terms | Added concise `terms.html`, separating website inquiries from actual installation/monitoring agreements and explaining that the website is not an emergency channel. This is a useful clarification, not a finding that every brochure website must publish terms. Footer terms are not a replacement for agreed customer contracts. |
| Cookies and marketing | No ad pixels, analytics, embedded maps/video, visitor recording, newsletters or marketing enrollment were found in the supplied code. Google Maps links open externally. Fonts and Lenis are now local. No broad consent banner added for this configuration; necessary Cloudflare security processing is disclosed. A new tracking or marketing feature requires a fresh assessment. |
| Claims and content rights | Owner must verify the stated 40+ years, 24/7 monitoring, “real calls” incident stories, customer privacy/permissions, and rights to images/logo/copy. Those claims have not been independently verified. A general disclaimer cannot repair misleading advertising. NJ's advertising rule requires objective assertions to be substantiated. [NJ rule](https://www.law.cornell.edu/regulations/new-jersey/N-J-A-C-13-31A-1-13) |
| Accessibility | Maintain usable labels, keyboard navigation, focus feedback, reduced-motion behavior and a phone alternative. Improvements include a mobile-menu focus boundary and background inertness, visible initial headings, and recovery if animation JavaScript fails. These are practical checks, not a certification. DOJ identifies inaccessible business websites as an access barrier. [DOJ guidance](https://www.ada.gov/resources/web-guidance/) |

Keep data collection limited to what the inquiry needs. Do not request alarm credentials or payment information in this form. Set a real retention practice in the mailbox and provider accounts, and keep privacy statements consistent with it. The FTC emphasizes honoring privacy promises and retaining only necessary data. [FTC privacy/security guidance](https://www.ftc.gov/business-guidance/privacy-security), [Start with Security](https://www.ftc.gov/business-guidance/resources/start-security-guide-business).

## Security findings and remediation

These are source/configuration findings, not evidence of a past compromise. Tests used controlled local requests and provider mocks; no spam, load testing, account access attempts or exploitation was performed against the live site.

| Priority | Finding | Prepared change / remaining action |
| --- | --- | --- |
| High for launch | Form was disabled (`data-endpoint=""`) and no backend was supplied. Connecting an unprotected email endpoint would allow spam and quota abuse. | Implemented same-origin `/api/contact`, required server-side Turnstile verification with hostname/action checks, IP and shared send rate limits, a honeypot and request-size limits. Remains disabled until configured. |
| High if incorrectly deployed | Adding server code, configs, local secrets and reports to a folder previously uploaded wholesale creates a source/secret exposure risk. | Explicit build copies only HTML, public assets, robots/sitemap and generated routing/headers to `dist/`. Browser checks verify private paths are 404. Deploy via the supplied Worker configuration, not a repository-root asset upload. |
| Medium | Temporary host returned no CSP, anti-framing, nosniff, referrer/permissions policy or HSTS headers in the inspected response. | Added security headers for static responses and equivalent headers for API responses. CSP disallows inline executable scripts and event attributes, external scripts except Turnstile, objects and framing. Existing inline styles remain permitted. HSTS deliberately does not claim all subdomains or request preload. No live changes made. |
| Medium | All pages loaded JavaScript from a third-party CDN without integrity metadata, and fonts from Google. | Pinned existing Lenis file and fonts are now hosted locally; included license notices. Turnstile remains an intentional trusted external script on enabled contact pages. |
| Medium once enabled | Client-only validation can be bypassed; arbitrary sender/recipient fields or markup could turn a form into an email relay or injection surface. | Backend validates required text, lengths, email format, enums, duplicate/unknown fields, uploads and control characters. It uses fixed sender/recipient/subject, validated Reply-To and plain text. There is no browser-held email secret. |
| Medium operational | Distributed abuse and provider quota exhaustion cannot be completely prevented by a client challenge or local edge counters. | Binding limits are approximately 5 attempts/IP/minute and 20 verified sends/minute/location. They are not strict worldwide caps. Monitor Resend usage; add WAF rules or a centralized strict budget if actual abuse warrants it. A configuration kill switch stops submissions. [Cloudflare rate-limit limitations](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) |
| Low–medium reliability | A generic 200 page could otherwise be mistaken for successful submission; network failures can discard input or expose internals. | Client requires JSON `ok: true`; it preserves inputs on errors, disables repeated submission while sending, resets the challenge and reports timeouts. The server confirms Resend returned an ID and returns generic errors. Email acceptance is not inbox delivery; timeout/ambiguous outcomes may need a phone check before retrying. |
| Ongoing | Source audit cannot inspect account security, DNS, WAF settings, TLS configuration, mailbox access, live secrets or real delivery. | Owner setup/checklist in README. MFA and restricted sending-only/domain-scoped keys are recommended. No production-domain/DNS/account changes were made. |

No database, authentication, checkout, file upload feature or production npm dependency existed in the supplied project. Therefore SQL injection, session theft, password resets and account authorization are not active features to audit here; revisit those concerns if such functionality is introduced. User content is not rendered into the website. No matching Resend/GitHub/AWS access-key or private-key patterns were found in the checked tracked website text; this limited pattern check is not proof the whole Git history or all external accounts are secret-free.

No submitted content, email addresses, secrets, tokens or provider response bodies are explicitly logged by the Worker. Request-level observability is disabled in the supplied config; Cloudflare platform/security records, Resend and mailbox storage still exist. Account-level logging and retention must be checked separately. The CSP is useful defense in depth, not a substitute for validation.

## Performance and SEO

The site already has useful foundations: server-served HTML, descriptive titles/descriptions, one H1 per page, canonical/social tags, a sitemap, responsive WebP images, dimensions, below-fold lazy loading and business/article structured data. Keeping the static architecture is appropriate.

Implemented:

- Extracted identical logo paths into one reusable `assets/img/logo-symbols.svg`, preserving the existing logo styling and masks. This removes repeated markup from all pages and lets browsers cache the logo.
- Hosted the existing font files and pinned Lenis locally. Fonts retain `font-display: swap`; the primary font is preloaded.
- Removed the font-readiness gate (up to 900 ms), made initial H1s immediately visible, shortened the deliberate navigation hold from 620 ms to 180 ms, and added a fallback if animation initialization fails. Existing page effects otherwise remain.
- Added explicit browser caching for assets. HTML continues to revalidate. Mutable images/CSS/JS use one day; versioned font/vendor files use immutable caching.
- Made the final origin configurable across canonical tags, Open Graph, JSON-LD, robots and sitemap; added the legal pages to the sitemap. Added `/index.html` → `/` canonical redirect while preserving `.html` routes and real 404 responses.
- Disabled indexing for preview builds and always for the supplied temporary hostname and `workers.dev` preview URLs. Do not enable production indexing while the domain placeholder remains.

File measurements (local byte counts; gzip for comparison, not a promise of Cloudflare's chosen compression):

| Asset | Before raw | After raw | Before gzip | After gzip |
| --- | ---: | ---: | ---: | ---: |
| Homepage HTML | 161,378 B | 45,005 B | 53,679 B | 9,878 B |
| Contact HTML | 141,321 B | 25,866 B | 49,861 B | 6,584 B |
| Shared logo, separate new asset | embedded repeatedly | 116,459 B | embedded repeatedly | 42,106 B |

The HTML reductions are about 72% and 82% raw. The shared logo still downloads on the first visit; the main benefit is reuse across later pages/visits. These figures do **not** establish a percentage improvement in total page weight, LCP or search rankings. No production Core Web Vitals score has been measured for the new build.

Recommended next, in order:

1. Launch-domain correctness: real origin, exact allowed origin/Turnstile hostnames, preferred-host/HTTPS redirects, legal details and preview noindex. Confirm live sitemap, canonical/schema URLs, headers and 404/redirect behavior after deployment.
2. Search Console and Google Business Profile: submit the final sitemap, check index coverage and keep business address/phone/service details accurate. Avoid fabricated review schema, project claims or thin location pages. [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
3. Measure mobile performance on the actual final domain using PageSpeed Insights/Lighthouse and later real-user Core Web Vitals. Inspect LCP candidates, CLS and interaction latency before further visual changes. [Google's Core Web Vitals guidance](https://developers.google.com/search/docs/appearance/core-web-vitals)
4. If image transfer dominates, tune per-component `sizes` for grids and consider further compression/AVIF for the largest photos. Existing 800/1600/2400 variants are already useful; do not remove quality blindly. Hero content should remain eager/high-priority and below-fold content lazy.
5. If traces show animation costs, reduce offscreen parallax/work, pause idle loops, and reconsider forced transitions. Existing reduced-motion handling is preserved. Avoid introducing an application framework or tracking scripts solely for this static site.

## Validation and limits

- 43 focused Worker tests cover successful multipart/text delivery, fixed recipient, input validation, payload caps, cross-site requests, missing configuration, rate-limit failures, Turnstile failures/scope, upstream errors and safe responses.
- Cloudflare deployment dry run passes with both rate-limit bindings and the asset manifest; no production publish occurs in that command.
- All 9 browser tests pass, covering every HTML page, CSP/runtime errors, images/fonts/logo rendering, safe 404s for private paths, disabled form fallback, mocked submission success/errors, mobile navigation/focus recovery, animation-script failure and JavaScript-disabled content.
- Local crawl found no broken internal files/anchors or duplicate IDs in the built pages. Desktop screenshots confirmed the shared logo preserved the homepage design.
- Installation audit reported zero npm advisories for the pinned development dependency tree. This does not cover the separately vendored Lenis file, browser/runtime vulnerabilities, future advisories or account misconfiguration.
- No live email or real Turnstile challenge has been exercised; this needs the owner's sender domain, inbox and secrets. No live deployment, DNS change or real license verification was performed.

The legal/privacy assessment is based on the described local US business and inspected configuration as of the review date. A final blanket “legally compliant” or “fully secure” claim would go beyond this evidence.
