# Neweix Account Profile Operations and Service Contract

Status: implementation specification, not a production integration contract.

## Identity model
- A person authenticates with one Neweix Account.
- Personal and Business Profiles are subordinate identities owned by that Account.
- The Account, not a Profile, owns the single Eixon Wallet.
- A profile identifier is not an Account identifier and must never be accepted as proof of authentication.
- Supreme and Employee identities are separate privileged identity classes and must not be provisioned through customer signup.

## Implemented in this change
- Account-owned Personal and Business Profile records.
- One Personal Profile per Account.
- Account-owner RLS for profile reads and writes.
- Business Profile creation and default-profile selection.
- Editable display name and Business Profile public contact fields.
- Existing Account backfill and Personal Profile creation on new Account insertion.
- No user-controlled write access to profile type, owner, status, or verification status.

## Profile state and verification
- Business profiles start as `unverified`.
- The customer UI must not show a verified badge unless a trusted review process changes the status.
- Customer-editable fields do not include `verification_status`.
- Business verification submission, evidence storage, reviewer assignment, audit trail, approval/rejection and appeals require a separate workflow backed by Supreme's scoped Admin Grant model. This change does not pretend that verification is operational.

## Avatar handling
- The database permits an HTTPS avatar URL as a profile field.
- This change does not create a Storage bucket, upload endpoint, signed upload flow, image moderation, or deletion lifecycle. Do not present avatar upload as available until those controls are implemented.

## Active Profile and service propagation
- The default profile stored by Account is a UI preference only.
- It is not an authorization claim and does not automatically switch a user's identity inside Shop, Connect, Neweix+, or Eixon.
- Services must authenticate the central Account and independently authorize each requested action.
- A future shared contract may include a server-validated active profile reference, but it must be issued by trusted server-side code, bound to the authenticated Account, and checked against the profile ownership/status on every sensitive operation.
- Never trust a client-supplied profile ID, display name, business name, or user-editable Auth metadata as authorization.
- Do not put a profile ID in an authorization decision based only on `user_metadata`. If a future JWT claim is used, it must be server-managed and its freshness/revocation behavior explicitly designed.
- Until the contract is approved and implemented, downstream services should treat the Account as the sole authenticated principal.

## Release gates
1. Review the migration against the live Account schema and run Supabase security/performance advisors.
2. Apply migration in a controlled environment and test RLS with two distinct Accounts, including cross-account read/write denial.
3. Test Business Profile creation, edit and default selection, including duplicate/default race cases.
4. Add automated database tests for Account backfill and new Account provisioning.
5. Implement avatar upload and business verification as separate audited features.
6. Define and test the shared active-profile contract before downstream services consume it.
7. Complete legal review of Terms and Privacy Policy.
8. Deploy only after CI, migration checks, staging E2E tests and rollback planning pass.
