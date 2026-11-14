# Neweix Account Production Acceptance

**Audit date:** 2026-11-14  
**Repository:** `neweix24/account`  
**Canonical URL:** https://www.accounts.neweix.com

This document records the production checks required before a release is considered accepted. Configuration validation is not a substitute for real authentication tests.

## Current verified state

| Area | Observed state | Result |
|---|---|---|
| Production Worker | `neweix-account` | Present |
| Canonical hostname | `www.accounts.neweix.com` attached to `neweix-account` production | Verified |
| Non-www hostname | No exact DNS record and no Worker custom-domain attachment for `accounts.neweix.com` | Needs correction and HTTP verification |
| Backend binding | `NEWEIX_BACKEND` -> `neweix` / `production` | Verified |
| Supabase | Project `grhybvlhdnzlopwbaqun`, status `ACTIVE_HEALTHY` | Verified |
| Account migrations | Account identity, session, username, and reservation migrations appear in applied migration history through `20261113141413` | Verified |
| Username login function | `neweix-username-login`, active version 12 | Verified |
| Signup hook | `before-user-created`, active version 15 | Verified |
| Phone OTP mutations | `PHONE_OTP_FORWARDING_ENABLED=false` | Correctly disabled |
| Canonical site URL variable | Live Worker has `https://accounts.neweix.com`; production config file specifies `https://www.accounts.neweix.com` | Config not deployed |
| Cloudflare login IP-proof secret | `LOGIN_RATE_LIMIT_HMAC_SECRET` exists as a secret binding on `neweix-account` (value not exposed) | Verified |
| Supabase login IP-proof secret | Project owner reports the same secret was added to `neweix-username-login`; connector cannot inspect secret presence or compare values | Owner-confirmed; independently unverified |
| IP-based login throttling | Edge Function version 12 reads `LOGIN_RATE_LIMIT_HMAC_SECRET` and verifies the client IP HMAC proof | Configuration present; runtime test pending |
| Recent username-login function traffic | No requests to `/functions/v1/neweix-username-login` appeared in the available Supabase edge log window | No live login test evidence; disposable test-account run required |
| Supabase leaked-password protection | Reported unavailable on the project's current Free plan; Security Advisor reports it disabled | Plan limitation; do not block repeatedly on an unavailable toggle; risk remains documented |
| Account RPC security review | Five Account `SECURITY DEFINER` RPCs inspected; all require the caller's user/session identity. `anon` cannot execute them. | Code/grants reviewed; runtime tests pending |
| Private schema access | `anon` and `authenticated` lack `USAGE` on `private`; `service_role` has access | Verified |
| Authenticated browser flows | No controlled end-to-end acceptance evidence recorded | Pending |

## Release blockers and required actions

### 1. Align production hostname configuration

- Keep `www.accounts.neweix.com` as the canonical hostname.
- The production config in `wrangler.production.jsonc` already sets `NEXT_PUBLIC_SITE_URL=https://www.accounts.neweix.com`.
- Before deployment, confirm Supabase Auth Site URL and allowed redirect URLs include the canonical confirmation and recovery callback URLs.
- The Cloudflare zone has a general non-`www` redirect rule, but `accounts.neweix.com` currently has no exact DNS record and no Worker custom-domain attachment. Do not claim this alias works until a safe DNS/Worker configuration is applied and an HTTP 301 to the canonical hostname is verified.
- Do not change the live hostname binding as part of a routine application deployment.

### 2. Restore IP-based login throttling

The Account Next.js login action signs the client IP with `LOGIN_RATE_LIMIT_HMAC_SECRET`; the `neweix-username-login` Edge Function verifies that proof before applying the IP bucket.

- The project owner reports that one high-entropy value has been set in both runtimes. Cloudflare confirms the Worker secret name exists; the Supabase connector cannot inspect Edge Function secret values, so equality cannot be independently verified.
- The Edge Function version 12 reads `LOGIN_RATE_LIMIT_HMAC_SECRET` and validates the HMAC proof before selecting the IP rate-limit bucket.
- Do not add the value to `wrangler.production.jsonc`, `vars`, GitHub source, or logs.
- Supabase edge logs were inspected; no requests to `/functions/v1/neweix-username-login` were present in the available log window. This means there is no existing request evidence to validate the proof path.
- A controlled login test must still confirm that both identifier-level and IP-level rate limiting work. Until that test passes, treat IP throttling as configured but not runtime-verified.

### 3. Supabase Auth leaked-password protection plan limitation

The project owner reports that leaked-password protection is not available on the project's current Supabase Free plan. The Security Advisor continues to report it as disabled. Do not repeatedly request enabling this unavailable setting. Keep the limitation visible in release risk tracking; reconsider if the project plan changes or an equivalent control becomes available. This is not silently treated as enabled.

### 4. Security Advisor review

The latest Security Advisor response included:
- A warning that leaked-password protection is disabled.
- Warnings for six `SECURITY DEFINER` functions callable by authenticated users, including Account username/session RPCs.
- Informational RLS-without-policy findings, including private-schema tables intended to be server-only.

A read-only database review was performed:
- `neweix_change_account_username`, `neweix_list_account_sessions`, `neweix_record_password_changed_event`, `neweix_revoke_account_session`, and `neweix_validate_current_session` all validate `auth.uid()` and the active session. Session listing and revocation are scoped to the caller; the current session cannot be revoked through the secondary-session RPC.
- The reviewed Account RPCs are executable by `authenticated`, not by `anon`.
- The private schema is not usable by `anon` or `authenticated`; only `service_role` has schema usage. The private tables flagged by the linter are intended to remain server-only.
- The sixth warned function, `is_current_supreme_ruler()`, belongs to the separate Supreme authorization surface and was not changed in this Account task.

The Account RPC code/grants review is complete. Keep the runtime authorization tests below as a release requirement. Do not add broad RLS policies merely to silence the linter.

## Controlled end-to-end test plan

Use disposable test accounts only. Do not use real customer accounts or perform destructive tests against real user data.

### A. Signup and email confirmation
- [ ] Create a disposable account with a valid username and password.
- [ ] Confirm duplicate username rejection.
- [ ] Confirm signup email links return to `https://www.accounts.neweix.com/auth/confirm`.
- [ ] Confirm expired or invalid confirmation links fail safely.
- [ ] Confirm no session is granted before the required email verification.

### B. Username and email sign-in
- [ ] Sign in using the test account's username. (No disposable test-account credentials were available during this audit, so this has not been executed.)
- [ ] Sign out, then sign in using its email address.
- [ ] Confirm invalid credentials return a generic error.
- [ ] Confirm rate limiting works at the identifier level and, after secret provisioning, at the IP level.
- [ ] Confirm the sign-in flow never exposes service-role credentials.

### C. MFA optional and enforced paths
- [ ] For an account with no MFA factor, confirm normal sign-in reaches the protected Account page without an MFA challenge.
- [ ] For a separate test account, enroll and verify a TOTP factor.
- [ ] Sign out and sign in again; confirm protected Account routes require AAL2.
- [ ] Confirm invalid and expired TOTP codes are rejected.
- [ ] Confirm adding/removing additional factors requires AAL2 where applicable.
- [ ] Confirm a verified factor cannot be bypassed by directly requesting a protected route.

### D. Password recovery and sessions
- [ ] Request password recovery and confirm the callback uses the canonical hostname.
- [ ] Complete the recovery flow and set a compliant password.
- [ ] Confirm invalid/expired recovery links fail safely.
- [ ] Revoke a secondary session and verify it loses protected access.
- [ ] Confirm local sign-out and global/session revocation behave as designed.

### E. Phone verification
- [ ] Confirm phone-verification status can be read through the authenticated backend binding.
- [ ] Confirm OTP send/verify mutations return the expected disabled response while the flag is false.
- [ ] Only after provider credentials, delivery, abuse controls, and callback handling are tested in a controlled environment may OTP mutations be enabled.
- [ ] Never enable OTP forwarding as part of the initial production config deployment.

## Deployment gate

Production deployment is blocked until:
- [ ] The owner-reported shared HMAC secret is present in both runtimes and IP throttling passes a controlled runtime test.
- [ ] Supabase Auth canonical callback configuration is confirmed.
- [ ] The leaked-password protection Free Plan limitation is explicitly accepted as a release risk by the project owner, or an equivalent control is adopted.
- [ ] The controlled test plan above passes.
- [ ] The canonical and non-canonical hostname behavior is verified.
- [ ] A production deployment is explicitly authorized.

The production configuration PR and its Wrangler dry-run passed CI, but neither action deployed the production Worker. This checklist does not authorize a production deployment.
