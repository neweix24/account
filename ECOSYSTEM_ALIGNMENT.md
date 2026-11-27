# Neweix Account ecosystem alignment

**Canonical authority:** [Supreme Ecosystem Governance Charter](https://github.com/neweix24/supreme/blob/main/docs/ecosystem-governance-charter.md)

- Supreme is the highest and final authority for ecosystem policy, reserved approvals, Admin delegation and oversight.
- Admin is the day-to-day operational authority, but Account is the customer identity authority. Admin privileges are not derived from a customer Account row.
- Employees owns workforce/Admin identity records. Supreme owns the protected ruler identity and authority grant policy.
- Account owns customer credentials, Account IDs, profiles, customer sessions, recovery and verification.
- Service clients such as Shop, Connect, Eixon, Neweix+, and Eixora must use a reviewed, first-party, service-specific integration contract.
- A shared Supabase Auth project, anon key, copied cookie, customer Account ID, or browser metadata is not by itself proof of service access or Admin privilege.
- The canonical identity table is `public.account`; do not use legacy `public.neweix_accounts` names in new integrations.
- Phone OTP mutations remain disabled until provider and abuse-control acceptance. Production deployment and OIDC/service-client activation must be separately verified.
