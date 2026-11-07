# Supabase project setup checklist

Target project: the existing **Neweix** Supabase project. Do not create a separate database and do not apply Account migrations to Eixon.

## Required Auth settings before production

1. In Authentication → Providers, keep Email enabled and disable Google, Facebook, and every other social provider. This is an explicit product requirement.
2. Enable email confirmations. Confirm the email/password provider is enabled.
3. Set a minimum password length of at least 12 characters and enable leaked-password protection.
4. Configure a production SMTP sender and test signup confirmation, password recovery, resend confirmation, and delivery/bounce handling.
5. In Authentication → URL Configuration, set the production Site URL to the final Neweix Account origin and add only exact allowed callback URLs:
   - `<SITE_ORIGIN>/auth/confirm`
   - `<SITE_ORIGIN>/auth/update-password`
   - Local development callbacks only while actively developing.
6. Configure the signup confirmation email template for the PKCE token-hash callback:
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
   Ensure the template escapes/encodes query parameters correctly in its HTML link.
7. Configure the password recovery email to return to `<SITE_ORIGIN>/auth/update-password`.
8. Keep secret/service-role keys in server-side secrets only. The app uses the publishable key in its browser/server Supabase client.

## Database migration order and compatibility

1. Apply the Account foundation, private-data lockdown, username rate-limit, session, live-session, password-audit, and profile-consolidation migrations in repository order.
2. The profile-consolidation migration renames `public.neweix_accounts` to `public.account`, preserves existing usernames and Auth UUIDs, and merges legacy profile fields without deleting Auth users or credentials.
3. The legacy `public.customer_profiles` relation is retained temporarily because Eixon-owned routines still depend on it. Do not drop or truncate it as part of Account work. Eixon must migrate those routines independently.
4. Supreme identities are separate from Neweix Account and employee identities. Do not provision Supreme in `public.account` or `public.staff_profiles`.

## Username login rate limiting

The login Edge Function always applies the per-identifier limit. For the additional per-client-IP bucket, set the same randomly generated secret in both places:

- Account application server environment: `LOGIN_RATE_LIMIT_HMAC_SECRET`
- Neweix Supabase Edge Function secrets: `LOGIN_RATE_LIMIT_HMAC_SECRET`

The Account server signs the trusted incoming client IP; the Edge Function verifies the HMAC before using that IP for throttling. Without the secret, login continues with per-identifier throttling only. Never put this secret in a `NEXT_PUBLIC_` variable or commit its value.

## Central SSO configuration still required

Enable Supabase Auth's OAuth 2.1 / OpenID Connect server only when first-party client origins and callback URLs are finalized. Register each Neweix service separately, use authorization code + PKCE, exact redirect URI allowlists, short-lived access tokens, refresh-token rotation, and least-privilege scopes. This is first-party Neweix SSO, not Google/Facebook social login.

Do not register guessed redirect URLs. Eixon, Supreme, and any other service must provide their actual callback URLs and must independently enforce their own authorization rules.

## Deployment variables

Set these in the selected hosting environment:

- `NEXT_PUBLIC_SUPABASE_URL` — existing Neweix project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — active publishable key.
- `NEXT_PUBLIC_SITE_URL` — final Account application origin.
- `LOGIN_RATE_LIMIT_HMAC_SECRET` — optional shared server-only HMAC secret for IP-based throttling.

Then install from the pinned `package.json`, run typecheck/lint/build, deploy, and test all auth flows against the production domain.

## Acceptance tests

- A new email/password user receives a verification email and cannot use protected account pages before verification.
- A successful confirmation provisions exactly one `public.account` row.
- Existing Account usernames, Auth UUIDs, credentials, and sessions remain unchanged during profile consolidation.
- Duplicate usernames and duplicate email addresses fail safely.
- Invalid credentials return a generic error without revealing whether an account exists.
- Password reset responses are identical for known and unknown addresses.
- Recovery links can only update the password once and expire as configured by Supabase Auth.
- Session refresh works across navigation and browser restarts; logout invalidates the active session.
- A user can read/update only their own allowed profile fields.
- Anonymous users cannot read central account profiles or any private account/service/security tables.
- Google/Facebook/social provider login is absent and disabled.
- Each registered first-party service receives only its intended identity claims and independently checks service permissions.
