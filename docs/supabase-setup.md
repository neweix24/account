# Supabase project setup checklist

Target project: the existing **Neweix** Supabase project. Do not create a separate database.

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

## Central SSO configuration still required

Enable Supabase Auth's OAuth 2.1 / OpenID Connect server only when first-party client origins and callback URLs are finalized. Register each Neweix service separately, use authorization code + PKCE, exact redirect URI allowlists, short-lived access tokens, refresh-token rotation, and least-privilege scopes. This is first-party Neweix SSO, not Google/Facebook social login.

Do not register guessed redirect URLs. Eixon, Supreme, and any other service must provide their actual callback URLs and must independently enforce their own authorization rules.

## Deployment variables

Set these in the selected hosting environment:

- `NEXT_PUBLIC_SUPABASE_URL` — existing Neweix project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — active publishable key.
- `NEXT_PUBLIC_SITE_URL` — final Account application origin.

Then install from the pinned `package.json`, run typecheck/lint/build, deploy, and test all auth flows against the production domain.

## Acceptance tests

- A new email/password user receives a verification email and cannot use protected account pages before verification.
- A successful confirmation provisions exactly one `neweix_accounts` row.
- Duplicate usernames and duplicate email addresses fail safely.
- Invalid credentials return a generic error without revealing whether an account exists.
- Password reset responses are identical for known and unknown addresses.
- Recovery links can only update the password once and expire as configured by Supabase Auth.
- Session refresh works across navigation and browser restarts; logout invalidates the active session.
- A user can read/update only their own allowed profile fields.
- Anonymous users cannot read central account profiles or any private account/service/security tables.
- Google/Facebook/social provider login is absent and disabled.
- Each registered first-party service receives only its intended identity claims and independently checks service permissions.
