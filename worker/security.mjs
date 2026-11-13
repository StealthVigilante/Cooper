export const securityHeaders = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  // Scope to this hostname; do not make assumptions about other subdomains.
  "Strict-Transport-Security": "max-age=31536000"
};
