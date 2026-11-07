# Neweix Account

Neweix Account is the central identity and authentication platform for first-party Neweix services. Users create one Neweix Account and use it across approved services. Google, Facebook, and other social identity providers are not part of the sign-in design.

## Current architecture

- **Identity authority:** Supabase Auth in the existing **Neweix** Supabase project.
- **Database:** the existing Neweix PostgreSQL database; this repository does not create a second database.
- **Profile:** `public.neweix_accounts`, keyed by the immutable Supabase Auth user UUID.
- **Service access and security records:** private-schema tables, not exposed to the browser Data API.
- **Authorization:** each service must enforce its own permissions. A shared login does not grant access to every service feature.

## Implemented in this repository

- Next.js App Router application with landing, email/password signup, username-or-email/password login, protected account page, sign-out, and password recovery/update routes.
- Cookie-based Supabase SSR client and Next.js 16 `proxy.ts` session refresh.
- Protected `/account` and `/mfa` requests validate the JWT `session_id` against the live `auth.sessions` row; revoked or expired sessions are rejected before the page or server action runs.
- Session & device management: list active Auth sessions, revoke one other session, or sign out all other devices. Normal sign-out affects only the current browser.
- Central account profile, service registry, service-access, security-event, and device-trust database foundation.
- Existing Auth users are backfilled; new Auth users are automatically provisioned.
- Public profile access is owner-scoped with RLS and column-level update grants. Private service/security tables are RLS-enabled and inaccessible to `anon` / `authenticated` roles.
- Existing Neweix commerce tables and the existing `customer_profiles` / `staff_profiles` tables are intentionally left intact.

## Current implementation boundary

The web UI supports **username-or-email + password** through a server-side Supabase Edge Function. Users can optionally enable a TOTP authenticator app in Account → Security settings; accounts with a verified factor must complete the MFA challenge before accessing the account dashboard. The resolver never returns the account email to the browser, and applies persistent per-identifier throttling before credential verification. The limiter stores only one-way hashes, not usernames or emails. Phone sign-in, passkey enrollment, device fingerprint trust, and the OAuth 2.1 / OIDC service-provider integration still require implementation and configuration. Do not present these as available features.

## Authentication policy

- First-party email/password authentication.
- Phone/password authentication only after a suitable phone identity and SMS provider are configured in Supabase.
- Username/password requires a server-side identifier resolver; never expose a user lookup endpoint that reveals whether an email, phone, or username exists.
- Email/phone verification and password recovery must be enabled and tested before public launch.
- No Google or Facebook provider buttons or OAuth providers.
- Central SSO should use the Supabase OAuth 2.1 / OpenID Connect server capability with PKCE, after it is enabled and configured in the Supabase dashboard. This is distinct from social login.

## Environment variables

Use the Supabase project URL and a publishable key in browser code. A Supabase secret/service-role key must only exist in server-side secrets and must never use a `NEXT_PUBLIC_` prefix.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Verification and remaining launch work

- Applied both Account migrations to the existing Neweix Supabase project.
- Verified all 4 existing Auth users have a central account row (0 missing).
- Verified the Auth provisioning trigger creates a profile in a rolled-back test transaction.
- Verified the central profile has owner-scoped RLS and private Account tables deny direct `anon` / `authenticated` table access.
- The source has not yet been installed, typechecked, linted, built, or deployed in a runtime. Do not treat the UI as production-ready until those checks pass.
- TOTP authenticator enrollment, verification challenge, and removal UI are implemented using Supabase MFA. Phone sign-in, passkey enrollment, OAuth 2.1 / OIDC client setup, production SMTP, Supabase Auth security settings, and end-to-end integration tests remain to be completed. Session management uses the actual `auth.sessions` inventory. Individual revocation removes the matching session row, and the Next.js proxy checks the current JWT `session_id` against that table on every protected Account/MFA request. If the validation database call fails, the protected request fails closed with HTTP 503 without deleting the user's cookies.
- The Supabase security advisor reports leaked-password protection is disabled and reports several existing SECURITY DEFINER warnings in the broader Neweix project. These findings predate or are outside the new Account tables; they still require review before production launch.
