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
| Username login function | `neweix-username-login`, active version 11 | Verified |
| Signup hook | `before-user-created`, active version 15 | Verified |
| Phone OTP mutations | `PHONE_OTP_FORWARDING_ENABLED=false` | Correctly disabled |
| Canonical site URL variable | Live Worker has `https://accounts.neweix.com`; production config file specifies `https://www.accounts.neweix.com` | Config not deployed |
| Login IP-proof secret | No `LOGIN_RATE_LIMIT_HMAC_SECRET` binding on the live Account Worker | Missing |
| Supabase leaked-password protection | Supabase Security Advisor reports it disabled | Needs enablement or explicit risk acceptance |
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

- Create one high-entropy secret value.
- Set the exact same value as a Cloudflare Worker secret on `neweix-account` and as a Supabase Edge Function secret for `neweix-username-login`.
- Do not add it to `wrangler.production.jsonc`, `vars`, GitHub source, or logs.
- Verify both sides use the same value without printing it.
- Confirm that a controlled test produces identifier-level and IP-level rate limiting.
- Until this is done, the Edge Function falls back to identifier-based throttling; do not describe IP-based throttling as active.

### 3. Enable Supabase Auth password protection

The Supabase Security Advisor currently reports leaked-password protection as disabled. Enable it in the project's Auth password security settings, then verify that signup and password changes still follow the Account password policy.

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
- [ ] Sign in using the test account's username.
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
- [ ] The shared HMAC secret is configured in both runtimes and IP throttling is verified.
- [ ] Supabase Auth canonical callback configuration is confirmed.
- [ ] Leaked-password protection is enabled or the risk is explicitly accepted by the project owner.
- [ ] The controlled test plan above passes.
- [ ] The canonical and non-canonical hostname behavior is verified.
- [ ] A production deployment is explicitly authorized.

The production configuration PR and its Wrangler dry-run passed CI, but neither action deployed the production Worker. This checklist does not authorize a production deployment.
