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

The existing Cloudflare Worker `neweix` has the custom domain `accounts.neweix.com`, and its deployed application already implements these phone-verification routes:

- `/api/account/phone/status`
- `/api/account/phone/send-otp`
- `/api/account/phone/verify-otp`

The deployed API response contract is:

- Status: `{ success: true, verified, phone, maskedPhone, verifiedAt }`
- Send OTP: `{ success: true, challengeId, expiresIn: 300, resendAfter: 60, message }`
- Verify OTP: `{ success: true, phone, message }`

Errors are JSON objects with an `error` field and an appropriate non-2xx HTTP status. Every route authenticates the current user from the Supabase session cookie. The send route reserves the OTP challenge atomically, enforces cooldown/daily limits, and sends through the existing BulkSMSBD binding. The verify route checks the challenge against the authenticated user and consumes it through the existing database RPC.

The Account UI uses relative same-origin paths and `credentials: "same-origin"`. This is correct only after the Account Next.js application is actually served on `https://accounts.neweix.com` by the same Worker or a reviewed routing architecture. Cloudflare currently attaches that hostname to the existing `neweix` Worker; this repository has no Worker deployment configuration yet. A hostname binding alone does not deploy this repository.

Do not deploy a second Worker to the same hostname without first migrating or securely proxying the existing phone API routes. Do not detach the current custom domain as an experiment. The Account SSR and proxy clients now set the same production Supabase cookie scope as the existing Worker: domain `.neweix.com`, path `/`, SameSite=Lax, Secure, and one-year max age.

The Account page independently validates the Supabase user, live session, and active account before rendering. The Worker remains responsible for authenticating every API request; UI checks are not a substitute for Worker authorization.

Do not forward service-role credentials or BulkSMSBD secrets to the browser. Do not weaken the Worker authentication checks or expose an unauthenticated OTP endpoint to work around cookie issues.

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
