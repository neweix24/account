# Neweix Account messaging providers

Neweix already has provider configuration in Cloudflare. Reuse it. Do not create duplicate provider credentials, DNS records, or a second SMS delivery service.

## Existing provider configuration

### Resend

The `neweix.com` domain is verified in Resend. Cloudflare contains the existing records:

- `resend._domainkey.neweix.com` — DKIM TXT
- `send.neweix.com` — Resend return-path CNAME
- `rsend.neweix.com` — Resend return-path CNAME

All three records are DNS-only. Do not replace, proxy, or delete them.

The Resend account already has existing API keys and successful transactional email history. Reuse the existing Supabase Auth SMTP configuration if it is already connected. The Cloudflare/Resend connector cannot prove which SMTP credential is currently saved inside Supabase Auth, so verify that setting only if an email delivery test fails. Do not create another Resend domain or API key as part of this change.

Supabase Auth remains responsible for email confirmation, recovery tokens, expiry, and verification. Resend is the delivery provider only.

### BulkSMSBD

The existing Cloudflare Worker script `neweix` already has:

- `BULKSMSBD_API_KEY` as a secret binding
- `BULKSMSBD_SENDER_ID` as a plain-text binding
- A working integration in its deployed code with `https://bulksmsbd.net/api/smsapi`
- An authenticated balance-check endpoint at `/api/admin/bulksms`

Do not copy the BulkSMSBD API key into Supabase Edge Function secrets and do not create another SMS sender integration.

## Existing Neweix phone-verification API

The deployed Cloudflare Worker already implements the phone-verification flow:

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/account/phone/send-otp` | Creates a six-digit challenge, enforces cooldown/daily limits, and sends the OTP through BulkSMSBD |
| POST | `/api/account/phone/verify-otp` | Verifies the challenge and records the verified phone |
| GET | `/api/account/phone/status` | Reads the signed-in user's phone-verification status |

These routes require the user's authenticated Neweix session. The send route accepts a JSON body containing `phone`; the verify route accepts `challengeId` and `otp`. The API validates Bangladesh mobile numbers, reserves challenges atomically, expires OTPs after five minutes, applies a 60-second resend cooldown, and enforces daily limits. The deployed worker owns this flow and its database operations.

Account integration must call these existing routes using the authenticated session. Do not implement another OTP generator, challenge table, SMS hook, or direct BulkSMSBD request in the Account repository.

### Account UI integration and session handling

The existing Cloudflare Worker `neweix` has the custom domain `accounts.neweix.com`. Its deployed OpenNext/Next.js application already implements these phone-verification routes:

- `/api/account/phone/status`
- `/api/account/phone/send-otp`
- `/api/account/phone/verify-otp`

The deployed API response contract is:

- Status: `{ success: true, verified, phone, maskedPhone, verifiedAt }`
- Send OTP: `{ success: true, challengeId, expiresIn: 300, resendAfter: 60, message }`
- Verify OTP: `{ success: true, phone, message }`

Errors are JSON objects with an `error` field and an appropriate non-2xx HTTP status. Every route authenticates the current user from the Supabase session cookie. The send route reserves the OTP challenge atomically, enforces cooldown/daily limits, and sends through the existing BulkSMSBD binding. The verify route checks the challenge against the authenticated user and consumes it through the existing database RPC.

This repository now includes a Cloudflare service-binding proxy for those three fixed API paths. The Account browser makes same-origin requests to its own `/api/account/phone/*` route handlers. The route handlers forward the signed-in user's cookie server-to-server through the `NEWEIX_BACKEND` service binding to the existing `neweix` Worker. Provider secrets and the Supabase service-role key remain inside the existing Worker and are never sent to the browser.

The separate preview Worker is named `neweix-account-preview` and has no custom domain or DNS route. Its Wrangler configuration targets the existing `neweix` Worker in the production environment using a service binding. The status route can be exercised on preview, but send and verify requests return HTTP 503 unless `PHONE_OTP_FORWARDING_ENABLED=true` is explicitly configured. This prevents accidental production SMS delivery during preview testing.

The preview Account app uses a host-only Supabase cookie on its `workers.dev` hostname. The backend proxy preserves that cookie for the internal Worker request and rewrites any refreshed cookie's Domain attribute to match the Account environment. For the eventual `accounts.neweix.com` deployment, set `AUTH_COOKIE_DOMAIN=.neweix.com` so the browser receives the intended shared Neweix session cookie.

Cloudflare currently attaches `accounts.neweix.com` to the existing `neweix` Worker, which also serves other Neweix subdomains. This repository is not proven to be the source tree currently deployed to that Worker. Do not move the hostname or detach the existing custom domain until the preview has passed acceptance tests and a controlled cutover plan is approved.

The Account page independently validates the Supabase user, live session, and active account before rendering. The existing Worker remains responsible for authenticating every API request; UI checks are not a substitute for Worker authorization.

Do not forward service-role credentials or BulkSMSBD secrets to the browser. Do not weaken the Worker authentication checks or expose an unauthenticated OTP endpoint to work around session issues.

## Acceptance tests

1. An authenticated user can request an OTP for a valid Bangladesh mobile number.
2. An unauthenticated request is rejected.
3. Invalid phone numbers are rejected before sending.
4. Resend cooldown and daily request limits are enforced.
5. A valid OTP verifies the intended user's phone only.
6. Expired, reused, or incorrect OTPs fail safely.
7. A phone number already verified on another account cannot be claimed.
8. Provider failures do not mark a phone number as verified.
9. No OTP, phone number, API key, or secret is exposed in browser responses or logs.
10. Email confirmation and password recovery continue through the existing Resend/Supabase Auth delivery configuration.

A successful BulkSMSBD API response confirms provider acceptance, not handset delivery. Confirm actual delivery in the provider's delivery report.
