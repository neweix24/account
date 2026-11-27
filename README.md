# Neweix Account

Neweix Account is the central customer identity service for the Neweix ecosystem.

## Ownership

Account owns customer signup/login, credentials, canonical Account ID, customer profiles, recovery, customer sessions, verification, and customer security settings.

Account does not own:
- Supreme's protected ruler identity or Supreme authorization.
- Admin or employee workforce identity and delegated permissions.
- EIX balances, wallet/ledger data, Shop orders, Connect messages, Neweix+ entitlements, or Eixora social content.

Supreme is the highest and final ecosystem authority. Admin conducts day-to-day operations through scoped service interfaces after Supreme approves the relevant Admin grant. Account must never infer Admin or Supreme authority from customer metadata, a profile field, username, or client-supplied role.

## Service integration

Neweix Account is the only customer identity authority. Other customer-facing services must use a reviewed first-party service-client/OIDC contract. A shared Supabase Auth project or a copied cookie is not a secure SSO contract by itself.

The canonical Account identity table is `public.account`. Legacy application code or service integrations must not assume the old `public.neweix_accounts` table still exists.

## Current status

The Account application and customer Auth foundation are present in this repository. Production custom-domain/Worker setup is documented. The most recent production deploy workflow failed on 2026-11-14 because `CLOUDFLARE_API_TOKEN` was unavailable in the GitHub Actions environment. The build itself completed, but the deploy did not.

The first-party OIDC/service-client contract and controlled end-to-end acceptance for other services remain release gates. Phone OTP mutations remain disabled until provider delivery and abuse controls are tested.

See [PRODUCTION_ACCEPTANCE.md](./PRODUCTION_ACCEPTANCE.md) and the [canonical Supreme Ecosystem Governance Charter](https://github.com/neweix24/supreme/blob/main/docs/ecosystem-governance-charter.md).
