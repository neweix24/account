# Neweix Account

Neweix Account is the central **customer identity and authentication platform** for first-party Neweix services. Customers create one Neweix Account and use it across approved services. Employee identities and the Supreme identity remain separate systems. Google, Facebook, and other social identity providers are not part of the sign-in design.

## Current architecture

- **Identity authority:** Supabase Auth in the existing **Neweix** Supabase project.
- **Database:** the existing Neweix PostgreSQL database; this repository does not create a second database.
- **Profile:** `public.account`, keyed by the immutable Supabase Auth user UUID. The profile-consolidation migration must be applied before deploying this revision of the application.
- **Service access and security records:** private-schema tables, not exposed to the browser Data API.
- **Authorization:** each service must enforce its own permissions. A shared login does not grant access to every service feature.

## Implemented in this repository

- Next.js App Router application with landing, email/password signup, username-or-email/password login, protected account page, sign-out, and password recovery/update routes.
- Cookie-based Supabase SSR client and Next.js 16 `proxy.ts` session refresh.
- Protected Account and MFA requests validate the JWT session ID against the live `auth.sessions` row.
- Session & device management: list active Auth sessions, revoke one other session, or sign out all other devices.
- Password & security management: current-password verification, minimum password length, security-event audit, and revocation of other sessions.
- TOTP authenticator enrollment, verification challenge, and removal using Supabase MFA.
- Central Account profile, unique Account ID, service registry, service-access, security-event, and device-trust database foundation.
- Existing Auth users are provisioned without changing their UUIDs or credentials; profile consolidation preserves existing usernames and merges compatible legacy profile fields.
- Public profile access is owner-scoped with RLS and column-level update grants. Private service/security tables are inaccessible to client roles.
- Commerce and other service-owned business data remain in their respective services; only central identity/profile fields are owned by Account.

## Authentication policy

- First-party email/password authentication.
- Username/password uses a server-side identifier resolver and persistent throttling.
- Phone verification is stored on the central Account profile; OTP delivery requires an SMS provider and a completed Account verification flow.
- No Google or Facebook provider buttons or OAuth providers.
- Central SSO should use the Supabase OAuth 2.1 / OpenID Connect server capability with PKCE after it is enabled and configured in Supabase.

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `LOGIN_RATE_LIMIT_HMAC_SECRET` (optional, server-only; use the same value in the Account host and Supabase Edge Function to enable client-IP throttling)

A Supabase secret/service-role key must only exist in server-side secrets and must never use a `NEXT_PUBLIC_` prefix.

## Database migration safety

- Apply the migrations to the existing **Neweix** Supabase project, not the Eixon project.
- The profile-consolidation migration renames `public.neweix_accounts` to `public.account`, preserves existing Account usernames and Auth UUIDs, and merges legacy profile fields.
- The legacy `public.customer_profiles` relation is retained temporarily because Eixon-owned database routines still depend on it. Do not drop it from this repository; Eixon must migrate its own routines independently before that compatibility data can be retired.
- Supreme identity is separate and is not provisioned as a Neweix Account or employee profile.

## Verification and remaining launch work

The repository includes CI for typecheck, lint, and production build. Run browser end-to-end verification before deployment. Production SMTP, SMS provider configuration and the Account phone-verification UI/flow, leaked-password protection, and OAuth 2.1 / OIDC client registration remain launch tasks.
