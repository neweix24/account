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
| Supabase leaked-password protection | Supabase Security Advisor reports it disabled | Needs review/enablement |
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

### 3. Review Supabase Auth password protection

The Supabase Security Advisor currently reports leaked-password protection as disabled. Enable it in the project's Auth password security settings, then verify that signup and password changes still follow the Account password policy.

### 4. Review Security Advisor findings

The latest Security Advisor response included:
- A warning that leaked-password protection is disabled.
- Warnings for six `SECURITY DEFINER` functions callable by authenticated users, including Account username/session RPCs.
- Informational RLS-without-policy findings, including private-schema tables intended to be server-only.

Before sign-off:
- Review the function bodies and grants for each Account RPC to confirm every function enforces the intended `auth.uid()` and ownership checks.
- Confirm private schemas are not exposed through the Data API and that server-only tables remain inaccessible to `anon` and `authenticated`.
- Do not add broad RLS policies merely to silence the linter; the private tables are intentionally server-only.

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
- [ ] Account RPC security findings are reviewed.
- [ ] The controlled test plan above passes.
- [ ] The canonical and non-canonical hostname behavior is verified.
- [ ] A production deployment is explicitly authorized.

The production configuration PR and its Wrangler dry-run passed CI, but neither action deployed the production Worker. This checklist does not authorize a production deployment.
