# Neweix Account — Identity Architecture

## Product contract

One person has one canonical Neweix identity. That identity is authenticated centrally and may be used by multiple first-party Neweix services. Each service remains responsible for its own domain data and authorization.

## Trust boundaries

1. Supabase Auth owns credentials, password hashes, email/phone verification, sessions, refresh tokens, and MFA factors.
2. `public.account` is the canonical user-facing identity profile and references `auth.users(id)`.
3. The `private` schema stores service registration, per-service access decisions, security audit events, and trusted-device hashes. It is not exposed through the public Data API.
4. Service-specific roles and business permissions remain in their owning service and must never be trusted from user-editable Auth metadata.

## Account lifecycle

- Signup creates a Supabase Auth user.
- An Auth database trigger creates the matching `account` row.
- Email/phone verification timestamps are synchronized from Auth.
- Password reset and MFA are handled by Supabase Auth.
- Account suspension/closure is an administrative workflow; service access must check account status.
- Existing Auth users are provisioned without changing their UUIDs or credentials.

## Username lifecycle

- Usernames are unique and limited to 3–20 lowercase English letters, digits, and underscores.
- A user may change their username once per 30-day period through the authenticated Account RPC.
- A username that is relinquished remains reserved for its former owner for 90 days. The former owner may reclaim it during that period, subject to the 30-day cooldown; other users and new signups are blocked by database enforcement.
- The private reservation registry is not exposed through the Data API and survives Auth-user deletion until reservation expiry. A database trigger enforces the reservation rule for signup provisioning and every username insert/update.
- Direct authenticated-role updates to `public.account.username` and `username_changed_at` are revoked so clients cannot bypass the cooldown or reservation rules.

## Sign-in identifiers

Supabase password sign-in accepts email or phone identifiers. Username sign-in uses a server-side resolver that maps a normalized username to the corresponding Auth login identifier without returning the identifier to an unauthenticated caller. The resolver is rate-limited and avoids account enumeration.

## First-party SSO

Use the Supabase OAuth 2.1 / OIDC authorization-code flow with PKCE for first-party service clients. Each client must have exact redirect URI allowlists and least-privilege scopes. Validate issuer, audience, signature, expiry, nonce/state, and PKCE. Access tokens should be short-lived; refresh tokens must be rotated and revocable. Register each service explicitly; do not accept arbitrary redirect URIs.

Enabling the Supabase OAuth server and registering clients is a project-level Auth configuration step. It is not equivalent to enabling Google/Facebook social login.

## Security controls

- Argon2id/password hashing is handled by Supabase Auth.
- Enable leaked-password protection and set a strong minimum password length in Auth settings.
- Require verified email before granting normal account access.
- Configure a production SMTP provider and tested recovery templates.
- Configure an SMS provider before offering phone OTP/phone verification.
- Offer TOTP MFA and WebAuthn/passkeys where supported; device biometrics should unlock a device-held credential and must not be uploaded as biometric data.
- Use secure, HttpOnly, SameSite cookies for browser sessions.
- Rate-limit signup, login, OTP, recovery, and username resolution.
- Never expose service-role/secret keys in client bundles.
- Keep audit records free of raw passwords, OTPs, access tokens, refresh tokens, or raw biometric data.

## Data model

- `auth.users`: credential identity and authentication state.
- `public.account`: canonical identity profile, unique Account ID, username, contact details, and verification state.
- `private.neweix_service_clients`: approved first-party client registry.
- `private.neweix_account_service_access`: per-user service access status.
- `private.neweix_account_security_events`: security audit events.
- `private.neweix_account_devices`: trusted-device registry storing only a one-way device fingerprint hash.

## Non-goals

This repository does not own Eixon's wallet/ledger, Supreme's administration, Neweix commerce orders, or any other service's domain database. Those systems consume the central identity and enforce their own authorization.
