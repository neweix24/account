# Neweix Account — Identity Onboarding & Profile Data Specification

Status: Proposed product and implementation specification. This document does not enable Google/Facebook sign-in or change the approved first-party-only authentication policy.

## 1. Product decision

Neweix Account remains the sole customer identity authority for the Neweix ecosystem. Registration must create one permanent Account per person. A person may later create multiple Personal/Business Profiles under that Account. Profiles are presentation and business-context identities, not separate login credentials or wallets.

The existing first-party signup flow remains canonical. Google and Meta/Facebook are reference models for consent, minimal data collection, and onboarding UX only. Do not add social login, social account linking, or provider SDKs unless Supreme explicitly changes the ecosystem policy.

## 2. What Google and Meta expose in a basic sign-in flow

### Google OpenID Connect

With `openid profile email`, Google may return:
- `sub`: stable Google account subject identifier. Use only as a provider identity key if federation is ever approved; never use email as the identity primary key.
- `email` and `email_verified`: email address and provider verification state.
- `name`, `given_name`, `family_name`, `picture`, `locale`: optional profile claims. Some claims may be absent.
- `aud`, `iss`, `exp`, `iat`, `nonce`: security claims that a relying party must validate.

Google's documentation explicitly warns that email can change and must not be used as the unique account identifier. Provider claims are not guaranteed to be present.

### Meta/Facebook

A basic `public_profile` grant can expose app-scoped user ID, first/last/middle name, display name, and profile picture. Email is a separate `email` permission and may be unavailable. Additional attributes such as birthday, age range, gender, location, friends, or other activity are not needed for Neweix registration and must not be requested by default. Some permissions require review or additional approval.

A Facebook app-scoped ID is not a global cross-app identity. If federation is ever approved, store provider + provider subject as a separate identity link, not as the Neweix Account ID.

## 3. Neweix registration fields

### Required at initial registration
- Full name: required, user-entered, 1–100 characters.
- Username: required, unique, 3–20 characters, ASCII letters/numbers/underscore; case-insensitive uniqueness; existing 30-day change limit and 90-day old-name reservation policy remain authoritative.
- At least one reachable identifier: email or mobile number. Require verification before granting full account access. If both are supplied, verify each independently.
- Password: required for the current first-party password flow; retain the 12–128 character policy and exact confirmation match.
- Acceptance of Terms of Service and Privacy Policy: explicit, timestamped, versioned consent. Do not bundle optional marketing consent into required acceptance.

### Optional, collected after account creation
- Profile photo/avatar.
- Preferred display name.
- Language preference (Bangla/English; default can follow browser/device preference but user can change it).
- Country/region and time zone, only when needed for localization; do not silently treat IP geolocation as verified residence.
- Date of birth only if a defined legal/age eligibility rule requires it. Otherwise do not collect it.
- Business profile name, business category, public contact details, and business verification documents only when the user creates a Business Profile and the specific feature requires them.
- NID verification remains optional and must not block ordinary account creation.

### Never request by default
- Facebook friends, posts, likes, contacts, birthday, gender, hometown, location history, education, workplace, or social graph.
- Google Drive/Gmail/Calendar scopes or any unrelated Google API access.
- NID, exact home address, date of birth, or business documents during basic signup unless a separately documented feature/legal requirement needs them.

## 4. Proposed signup journey

1. Create Account: full name, username, email or phone, password, confirm password, Terms and Privacy acceptance.
2. Verify contact: email link or phone OTP. Do not mark a contact verified merely because a user typed it or because a third-party profile claims it.
3. Account created: issue permanent Account ID server-side. Show it as immutable and explain that it is different from username.
4. Profile setup: optional avatar, display name, language, and profile details. Provide Skip for all nonessential fields.
5. Profile chooser: Personal Profile exists by default; allow Business Profile creation later without another login or another wallet.
6. Security setup: recommend MFA, passkey support as a future enhancement, recovery codes, active sessions and device management. Do not force optional TOTP enrollment.
7. Ecosystem consent: explain that the same Account is used across Neweix services through first-party service integration; each service receives only the claims/scopes it needs.

## 5. Canonical data ownership and proposed entities

Keep `public.account` as the canonical identity record. Do not overload it with provider profile payloads or business data.

Recommended logical model (adapt to existing schema before migrations):
- `account`: immutable Account ID, canonical status, created_at, primary profile reference if needed.
- `account_contact`: account_id, type (email/phone), normalized_value, verified_at, is_primary, created_at. Enforce uniqueness for verified identifiers according to the existing account policy.
- `account_profile`: profile_id, account_id, profile_type (personal/business), display_name, avatar_media_id, locale, status, created_at, updated_at.
- `account_profile_business`: profile_id, business_name, category, public_contact fields, verification_status. Only for business profiles.
- `account_consent`: account_id, consent_type, policy_version, accepted_at, withdrawn_at, source.
- `account_security_event`: append-only audit events for verification, recovery, MFA, session and sensitive profile changes.
- Future-only `account_identity_link`: provider, provider_subject, account_id, linked_at, revoked_at. Keep disabled until Supreme approves federation. Never use provider email as the linking key.

Do not create duplicate wallets for profiles. One Account owns one Eixon Wallet; Personal and Business Profiles use that same wallet under the approved Eixon rules. Profile switching must never switch the underlying Account identity or elevate permissions.

## 6. Trust, privacy, and security requirements

- Verify all contact ownership server-side. A provider's email_verified claim, if federation is later approved, must be validated and mapped under an explicit account-linking policy.
- Prevent account takeover during linking: require a fresh authenticated Neweix session and re-authentication; notify the user on the existing verified contact; never auto-link by matching email alone.
- Validate all external identity tokens server-side: issuer, audience, signature, expiry, nonce, state, and PKCE where applicable. Do not store provider access tokens unless a separately approved feature requires them.
- Collect only fields used by a documented Neweix feature. Show purpose and retention information before collection.
- Allow users to edit optional profile fields, remove avatar, manage contacts, review sessions, and request account closure under the account-retention policy.
- Keep Admin/Employee/Supreme authority separate from customer profile data. A profile field, badge, username, or external provider claim must never grant Admin or Supreme privileges.
- Rate-limit signup, verification, resend, recovery, username availability, and profile mutation endpoints. Use generic responses where needed to prevent account enumeration.
- Keep audit logs for security-sensitive changes without logging passwords, OTPs, raw tokens, or unnecessary personal data.

## 7. UI requirements based on the existing Neweix Account redesign

Use the existing Figma file and its current navy/electric-blue visual direction as the design source. Extend the current Account layout rather than creating a competing visual system.

Required screens/states:
- Signup form with clear required/optional grouping, Bangla/English copy, password visibility, strength guidance, and inline validation.
- Contact verification screen with masked destination, resend cooldown, change-contact action, and expiry/error states.
- Profile setup with optional avatar and a visible Skip action.
- Account overview showing immutable Account ID, username, verification states, and profile switcher.
- Profile management with Personal and Business Profile cards and clear distinction between Account-level and Profile-level settings.
- Connected identity section should not appear as active functionality until federation is approved; if shown in future, clearly list provider, linked date, permissions, and unlink action.

Mobile must use compact navigation, accessible touch targets, readable forms, and no tall oversized navigation rows. Desktop and mobile must share tokens and component behavior.

## 8. Rollout gates

1. Review current database schema and existing signup action before proposing migrations.
2. Confirm contact verification and consent persistence are implemented and tested.
3. Implement optional profile setup without breaking existing Account records.
4. Add Personal/Business Profile model only after checking current tables and all service contracts.
5. Add automated tests for duplicate identifiers, username rules, verification bypass, consent versioning, profile isolation, wallet uniqueness, and privilege escalation.
6. Update Supreme's ecosystem registry/contracts before any cross-service identity claim is exposed.
7. Do not enable Google/Facebook authentication or provider linking without explicit Supreme policy approval and a separate security review.

## 9. Official reference documentation

- Google OpenID Connect: https://developers.google.com/identity/openid-connect/openid-connect
- Meta Facebook Login: https://developers.facebook.com/docs/facebook-login/
- Meta Graph API User fields: https://developers.facebook.com/docs/graph-api/reference/user/
