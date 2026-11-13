# Domain Configuration

- **Service:** Central Account identity and authentication service
- **Intended primary subdomain:** https://accounts.neweix.com
- **GitHub repository:** https://github.com/neweix24/account
- **DNS zone:** `neweix.com`

## Verified Cloudflare state

The hostname `accounts.neweix.com` is configured as a Cloudflare Worker custom domain and is currently attached to the existing `neweix` Worker service.

This confirms the hostname is routed to that Worker. It does **not** confirm that the Worker is built from this repository or serves this repository's Next.js application.

## Deployment blocker

This repository currently has no Cloudflare Worker configuration or deployment workflow. The existing custom domain is already assigned to the `neweix` Worker, so a second Worker cannot simply claim the same hostname.

Before production rollout, choose and implement one reviewed deployment architecture:

1. Integrate this Account application into the existing `neweix` Worker deployment; or
2. Move the hostname to a dedicated Account Worker and securely preserve the existing phone API routes, for example through an authenticated service binding or a reviewed reverse-proxy design.

Do not detach or replace the existing Worker custom domain until the replacement architecture is deployed and tested. Do not change DNS as a workaround.

## Session compatibility

The existing Worker uses Supabase auth cookies scoped to `.neweix.com`, path `/`, SameSite=Lax, Secure, with a one-year max age. This repository now uses matching production cookie options so sibling Neweix subdomains can share the normal Supabase session.

This cookie alignment does not itself deploy the Account app or prove that both applications are currently served from the same hostname.

## Ownership

This repository is the source-code home for the Central Account service. Keep service-specific application code, configuration, documentation, and deployment workflows here.
