# Neweix Account

Neweix Account is the central identity and authentication platform for first-party Neweix services. Users create one Neweix Account and use it across approved services. Google, Facebook, and other social identity providers are not part of the sign-in design.

## Current architecture

- **Identity authority:** Supabase Auth in the existing **Neweix** Supabase project.
- **Database:** the existing Neweix PostgreSQL database; this repository does not create a second database.
- **Profile:** `public.account`, keyed by the immutable Supabase Auth user UUID.
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
- Existing Auth users are provisioned without changing their UUIDs or credentials.
- Public profile access is owner-scoped with RLS and column-level update grants. Private service/security tables are inaccessible to client roles.
- Existing Neweix commerce and Eixon wallet/ledger domain data remain owned by their respective services; only identity/profile fields are centralized in Account.

## Authentication policy

- First-party email/password authentication.
- Username/password uses a server-side identifier resolver and persistent throttling.
- Phone verification is stored on the central Account profile; OTP delivery requires an SMS provider.
- No Google or Facebook provider buttons or OAuth providers.
- Central SSO should use the Supabase OAuth 2.1 / OpenID Connect server capability with PKCE after it is enabled and configured in Supabase.

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

A Supabase secret/service-role key must only exist in server-side secrets and must never use a `NEXT_PUBLIC_` prefix.

## Verification and remaining launch work

The existing migrations establish central identity, session management, live-session enforcement, and password-security auditing. The application source still requires install, typecheck, lint, build, and browser end-to-end verification before deployment. Production SMTP, SMS provider configuration, leaked-password protection, and OAuth 2.1 / OIDC client registration remain launch tasks.
