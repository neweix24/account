# Neweix Account Governance Boundary

**Canonical authority:** [Supreme-led Neweix Ecosystem Governance](https://github.com/neweix24/supreme/blob/main/GOVERNANCE.md)  
**Canonical registry:** [Ecosystem Service Registry](https://github.com/neweix24/supreme/blob/main/config/ecosystem-service-registry.json)  
**Service repository:** `neweix24/account`

## Service responsibility

Single source of truth for customer identity, permanent Account ID, usernames, customer authentication, profiles and customer sessions.

## Observed implementation status

Application exists; production deployment is blocked pending Cloudflare deployment credential/configuration. OIDC/PKCE service-client contract remains to be completed and verified.

## Required dependencies

Supreme policy and service registry; customer services consume Account-issued identity through audience-bound OIDC/OAuth2 Authorization Code + PKCE.

## Explicit boundaries

Become the Admin workforce authority, grant Supreme powers, own Eixon ledger, Shop orders or service-specific content.

## Authority model

- **Supreme is the highest authority** for ecosystem policy, service registration, privileged approval, top-level Admin grants, security exceptions and high-risk production activation.
- **Admin operates day-to-day activities across the ecosystem** only through explicit, scoped, time-bounded and auditable grants issued under Supreme policy.
- Service maintainers and service automation may operate only their own service resources. Repository write access does not confer production Admin authority.
- This repository may define service-specific operational roles, but may not redefine the global hierarchy or override the canonical registry.

## Change discipline

Changes to global policy or cross-service contracts must be proposed against the canonical governance repository and reviewed for impact on every affected service. Local documentation is subordinate to the canonical governance baseline. Do not copy the full ecosystem blueprint into this repository.

Production activation remains blocked wherever the observed status above or the canonical registry lists incomplete security, identity, payment, data or deployment gates.
