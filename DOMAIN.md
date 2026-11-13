# Neweix Account domain and deployment

- **Canonical Account URL:** https://www.accounts.neweix.com
- **Repository:** https://github.com/neweix24/account
- **Cloudflare zone:** `neweix.com`
- **Dedicated Account Worker:** `neweix-account-preview`
- **Shared backend Worker:** `neweix`

## Verified production routing

Cloudflare production Worker-domain configuration was inspected on 2026-11-13:

- `www.accounts.neweix.com` is attached to `neweix-account-preview`.
- `accounts.neweix.com` is also attached to `neweix-account-preview`.
- Both bindings were reported enabled.
- Do not assume a redirect between these hostnames from the Worker-domain listing alone. Verify actual HTTP behavior before changing canonical-host handling, cookies, or DNS.
- Do not detach either hostname, change DNS, or replace the Worker without a separately reviewed cutover and rollback plan.

The active production deployment observed on 2026-11-13 was 100% traffic on version `cd9dbc3d-a99d-4ee9-9942-b76649c4c770`, deployment `85127731-f495-4019-b4d3-3d81dca44c38`. This is a point-in-time observation, not a guarantee that the deployment remains unchanged.

## Repository deployment configuration

- `wrangler.jsonc` names the Worker `neweix-account-preview`.
- Its service binding `NEWEIX_BACKEND` targets the shared `neweix` Worker.
- The config includes production Supabase URL and publishable key as public application configuration. No service-role key or BulkSMSBD credential may be exposed to browser code.
- The `previews.vars` block intentionally uses a disabled/invalid Supabase endpoint and removes service bindings. Keep isolated previews disconnected from production services.
- The package script named `deploy:preview` invokes `opennextjs-cloudflare deploy`. A script name is not an environment boundary. Do not use it for deployment until the target environment, account, script name, vars, bindings, and domain effects have been explicitly verified.
- Never deploy this repository over the shared `neweix` Worker.

## Username policy

- Usernames are unique, 3–20 characters, and contain only lowercase English letters, digits, and underscores.
- A user may change their username once every 30 days.
- Every relinquished username remains reserved for its former owner for 90 days. The former owner may reclaim it during that period, subject to the 30-day change cooldown. Reservation records are private and survive deletion of the former Auth user until expiry.
- Username changes must use the authenticated Account RPC; direct client updates to `username` and `username_changed_at` are revoked.

## Service boundaries

This repository contains the separate Neweix Account Next.js application. The shared `neweix` Worker remains the owner of existing production services and authenticated phone-verification API operations. Account calls those fixed phone API routes through the `NEWEIX_BACKEND` Cloudflare service binding. The browser never receives BulkSMSBD or Supabase service-role credentials.

## Phone verification safety

- `PHONE_OTP_FORWARDING_ENABLED=false` is the required default.
- Phone-verification status may be read through the authenticated backend route.
- OTP send and verify mutations must remain disabled until provider delivery, rate limits, abuse controls, and end-to-end verification have passed in a controlled test environment.
- Do not enable OTP mutations as part of routine deployment or documentation work.

## CI status observed 2026-11-13

The latest recorded post-merge GitHub Actions run for main (run `43445608893`) failed before any job steps ran. Its job had no runner ID and no runner name. This is consistent with a runner/infrastructure failure, but it does not prove the application build passed or failed. Do not weaken checks or change application code to mask a job that never started.

## Production release gates

A successful source build or preview deployment does not prove that production Auth redirect allowlists, password recovery, SMS delivery, or authenticated browser flows work. Before declaring production-ready, verify with a dedicated test account:

1. Signup and email confirmation, including allowed callback URLs.
2. Username and email login, invalid credentials, and rate limiting.
3. Password recovery, PKCE/token-hash callback handling, and password update.
4. MFA enrollment, challenge, recovery, and removal behavior.
5. Session listing, remote revocation, expiry, and global sign-out.
6. Username change cooldown and reservation behavior through the UI.
7. Phone verification status and authenticated API authorization.
8. OTP send/verify only in a controlled test, with provider delivery and abuse controls verified.

Never use a real user's account for destructive acceptance tests. Do not enable OTP mutations until the controlled provider flow has passed. Do not upgrade paid plans or incur new infrastructure costs without explicit approval.

## Current readiness statement

As of the 2026-11-13 inspection, the dedicated Account Worker was live on both configured production hostnames and connected to production Supabase through its configured bindings. This does **not** constitute authenticated end-to-end acceptance testing or production security sign-off. The Cloudflare account was on the Free Website plan; no paid Cloudflare upgrade was used.
