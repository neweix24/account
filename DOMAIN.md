# Domain Configuration

- **Service:** Central Account identity and authentication service
- **Intended production hostname:** https://accounts.neweix.com
- **GitHub repository:** https://github.com/neweix24/account
- **DNS zone:** `neweix.com`

## Verified current Cloudflare topology

The Cloudflare custom domain `accounts.neweix.com` is currently attached to the existing Worker service `neweix` in its production environment. The same Worker also serves several other Neweix subdomains, including `www`, `shop`, `connect`, `employees`, `eixon`, and `eixora`.

The deployed `neweix` Worker is an OpenNext/Next.js application (its deployed bundle contains Next App Router route modules and the OpenNext server runtime). It already contains the authenticated phone-verification API routes and the BulkSMSBD integration. Its current bindings include the BulkSMSBD secret, Supabase configuration, and other production service credentials.

This repository is a separate Next.js Account application. It is **not** currently the source tree proven to be deployed as the existing `neweix` Worker. Do not assume that merging this repository automatically updates the production Worker.

## Safe deployment plan

1. Build and preview this repository as a separate Worker named `neweix-account-preview` on its `workers.dev` hostname. The Wrangler config intentionally does not claim any production custom domain or DNS route.
2. Use a Cloudflare service binding named `NEWEIX_BACKEND` to call the existing `neweix` Worker for the three phone-verification API routes. Forward the signed-in user's session cookie server-to-server; do not expose provider or service-role secrets to the browser.
3. Keep phone OTP send/verify forwarding disabled on preview by default. The status route can be checked without sending SMS. Enable OTP mutations only in an explicitly configured production environment after acceptance tests.
4. Validate sign-in, session refresh, status lookup, OTP send/verify, and logout on the preview hostname.
5. Only after validation, plan a controlled hostname cutover for `accounts.neweix.com`. The existing Worker currently owns that hostname, so do not add a competing custom domain, detach the current domain, or change DNS as part of preview work.

## Session cookies

The Account app uses a host-only cookie on the `workers.dev` preview hostname. This allows the preview app to manage its own Supabase session without trying to set a `.neweix.com` cookie from an unrelated hostname.

For the eventual production hostname, set `AUTH_COOKIE_DOMAIN=.neweix.com` so the Account app shares the intended Neweix session scope. The service-binding proxy preserves the session cookie when calling the existing Worker and rewrites any refreshed cookie domain to match the Account environment.

## Preview safety controls

- `PHONE_OTP_FORWARDING_ENABLED` defaults to `false` in Wrangler configuration.
- Preview status requests can reach the existing authenticated status endpoint.
- Preview send/verify requests return HTTP 503 until OTP forwarding is explicitly enabled.
- The preview Worker has no production custom domain or DNS route.
- Production Worker code, secrets, DNS, and custom-domain assignments are not modified by this repository setup.
