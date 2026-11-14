# Neweix Account domain and deployment

- **Canonical Account URL:** https://www.accounts.neweix.com
- **Repository:** https://github.com/neweix24/account
- **Cloudflare zone:** `neweix.com`
- **Production Worker:** `neweix-account`
- **Preview Worker:** `neweix-account-preview`

## Live routing verified 2026-11-14

- `www.accounts.neweix.com` is attached as an enabled production custom domain to the dedicated `neweix-account` Worker.
- The corresponding proxied Cloudflare DNS record exists for `www.accounts.neweix.com`.
- There is currently no exact DNS record for `accounts.neweix.com`, and it is not listed as a Worker custom domain. The zone has a general non-`www` redirect rule, but that rule cannot be relied on for this hostname until DNS resolution and an HTTP redirect are verified.
- Do not detach or reassign the canonical hostname, create a replacement DNS record, or change Worker bindings without a separately verified cutover plan.

## Production Worker bindings verified 2026-11-14

The live `neweix-account` Worker currently has:

- `ASSETS` asset binding.
- `NEWEIX_BACKEND` service binding to the `neweix` Worker production environment.
- Production Supabase project URL and a publishable/legacy anon key.
- `PHONE_OTP_FORWARDING_ENABLED=false`.

Two configuration and acceptance items remain:

1. The live `NEXT_PUBLIC_SITE_URL` value is `https://accounts.neweix.com`, while the canonical URL is `https://www.accounts.neweix.com`. The repository's `wrangler.production.jsonc` contains the canonical value, but that config has not been deployed.
2. Cloudflare now confirms that the `neweix-account` Worker has a `LOGIN_RATE_LIMIT_HMAC_SECRET` secret binding. The project owner reports setting the same secret for the `neweix-username-login` Supabase Edge Function. The Supabase connector cannot inspect secret values, so it cannot independently verify presence or equality. Edge Function version 12 reads this secret and verifies the client-IP HMAC proof. A controlled runtime test is still required before IP-based throttling can be marked fully verified. Never put this value in a checked-in file or a plain-text `vars` entry.

The project owner reports that Supabase leaked-password protection is unavailable on the current Free plan. The Security Advisor still reports it disabled; this remains a documented plan limitation and release risk, not an enabled control.

## Service boundaries

This repository contains the separate Neweix Account Next.js application. The shared `neweix` Worker remains the owner of existing production services and authenticated phone-verification API operations. Account calls those fixed phone API routes through the `NEWEIX_BACKEND` Cloudflare service binding. The browser never receives BulkSMSBD or Supabase service-role credentials.

## Username policy

- Usernames are unique, 3–20 characters, and contain only lowercase English letters, digits, and underscores.
- A user may change their username once every 30 days.
- Every relinquished username remains reserved for its former owner for 90 days. The former owner may reclaim it during that period, subject to the 30-day change cooldown. Reservation records are private and survive deletion of the former Auth user until expiry.
- Username changes must use the authenticated Account RPC; direct client updates to `username` and `username_changed_at` are revoked.

## Preview safety

- The preview Worker is `neweix-account-preview`; it must not deploy over the shared `neweix` Worker or the production `neweix-account` Worker.
- Phone OTP send and verify are disabled by default with `PHONE_OTP_FORWARDING_ENABLED=false`.
- OTP mutations must remain disabled until provider delivery, abuse controls, and end-to-end behavior pass a controlled test.
- The preview Worker uses host-only Supabase cookies on `workers.dev`.
- Callback origins are derived from the incoming allowed `workers.dev` host for isolated preview deployments. The production callback origin is `https://www.accounts.neweix.com`.

## Production readiness

A successful GitHub build, Wrangler dry-run, or preview deployment does not prove that production Auth redirect allowlists, password recovery, MFA, session revocation, or phone-verification flows work. Follow the release gates in [PRODUCTION_ACCEPTANCE.md](./PRODUCTION_ACCEPTANCE.md).

No production Worker deployment, custom-domain change, DNS change, Supabase Auth configuration change, or OTP enablement was performed as part of this audit.
