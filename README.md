# Neweix Account

Neweix Account is the central identity and authentication platform for first-party Neweix services. Users create one Neweix Account and use it across approved services. Google, Facebook, and other social identity providers are not part of the sign-in design.

## Current architecture

- **Identity authority:** Supabase Auth in the existing **Neweix** Supabase project.
- **Database:** the existing Neweix PostgreSQL database; this repository does not create a second database.
- **Profile:** `public.neweix_accounts`, keyed by the immutable Supabase Auth user UUID.
- **Service access and security records:** private-schema tables, not exposed to the browser Data API.
- **Authorization:** each service must enforce its own permissions. A shared login does not grant access to every service feature.

## Initial database foundation

The first migration adds the central account profile, a first-party service registry, per-service access records, security-event audit storage, and a device-trust registry. It also provisions profiles for existing Auth users and automatically provisions profiles for new users.

Existing Neweix commerce tables and the existing `customer_profiles` / `staff_profiles` tables are intentionally left intact.

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

## Status

The repository was empty at project start. This commit establishes the architecture and database migration. A deployable web application, username resolver, OAuth/OIDC client registration, email/SMS delivery setup, and end-to-end integration tests are follow-on implementation work and must not be represented as complete until built and verified.
