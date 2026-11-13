# Neweix Account domain and deployment

- **Canonical Account URL:** https://www.accounts.neweix.com
- **Repository:** https://github.com/neweix24/account
- **Cloudflare zone:** `neweix.com`
- **Preview Worker:** `neweix-account-preview`

## Current routing

The canonical `www.accounts.neweix.com` hostname is attached to the dedicated `neweix-account-preview` Worker. The zone redirects non-`www` HTTP hostnames to their corresponding `www` hostnames with a permanent redirect.

The legacy `accounts.neweix.com` hostname remains attached to the shared `neweix` Worker, but browser requests are redirected to `www.accounts.neweix.com`. Do not detach the legacy binding or change DNS without a separately verified cutover plan.

## Service boundaries

This repository contains the separate Neweix Account Next.js application. The shared `neweix` Worker remains the owner of existing production services and authenticated phone-verification API operations. Account calls those fixed phone API routes through the `NEWEIX_BACKEND` Cloudflare service binding. The browser never receives BulkSMSBD or Supabase service-role credentials.

## Preview safety

- Worker name remains `neweix-account-preview`; this repository must not deploy over the shared `neweix` Worker.
- Phone OTP send and verify are disabled by default with `PHONE_OTP_FORWARDING_ENABLED=false`.
- The preview can read phone-verification status through the authenticated backend route.
- OTP mutations return HTTP 503 until explicitly enabled in a controlled environment.
- The preview Worker uses host-only Supabase cookies on `workers.dev`.
- Callback origins are derived from the incoming allowed `workers.dev` host for isolated preview deployments. The production callback origin is `https://www.accounts.neweix.com`.

## Production readiness

A successful GitHub build or preview deployment does not prove that production Auth redirect allowlists, password recovery, SMS delivery, or authenticated browser flows work. Before any production cutover, verify signup confirmation, username/email login, MFA, password recovery, session revocation, phone status, and the controlled OTP send/verify path using a test account. Do not enable OTP mutations until the provider flow has been acceptance-tested.
