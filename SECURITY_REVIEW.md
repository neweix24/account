# Neweix Account security review

**Review date:** 2026-11-13  
**Supabase project:** `grhybvlhdnzlopwbaqun`  
**Scope:** Account-related SECURITY DEFINER RPCs, private-table grants, and current Supabase Security Advisor findings.

This is a point-in-time configuration review. It is not a penetration test or authenticated browser acceptance test.

## SECURITY DEFINER RPC review

The following six functions were inspected directly through PostgreSQL catalog metadata and `pg_get_functiondef`:

| Function | SECURITY DEFINER | Fixed search_path | anon EXECUTE | authenticated EXECUTE |
|---|---:|---:|---:|---:|
| `is_current_supreme_ruler()` | yes | empty | no | yes |
| `neweix_change_account_username(text)` | yes | empty | no | yes |
| `neweix_list_account_sessions()` | yes | empty | no | yes |
| `neweix_record_password_changed_event()` | yes | empty | no | yes |
| `neweix_revoke_account_session(uuid)` | yes | empty | no | yes |
| `neweix_validate_current_session()` | yes | empty | no | yes |

All six functions are owned by `postgres` and explicitly set `search_path TO ''`. Their object references are schema-qualified. The Account mutation/session functions validate the authenticated user and current session before accessing protected records. The session revocation function additionally restricts deletion to the caller's own Auth session and refuses to revoke the current session.

The authenticated EXECUTE grants are intentional application interfaces, not automatically vulnerabilities. Do not revoke them solely to silence the generic Security Advisor warning; doing so would break the Account application. Any future SECURITY DEFINER function must use an empty/fixed search path, schema-qualified references, narrow grants, and explicit caller/ownership checks.

## Private-table access review

The following five `private` tables were verified to have RLS enabled and no direct table privileges for `anon` or `authenticated`:

- `neweix_account_devices`
- `neweix_account_security_events`
- `neweix_account_service_access`
- `neweix_account_username_reservations`
- `neweix_login_rate_limits`

The Supabase Advisor reports “RLS enabled, no policy” for these tables. This is intentional for private tables accessed only by controlled server-side/SECURITY DEFINER paths. Do not add broad policies merely to remove the informational warning.

The same no-direct-grants check was also observed for the listed `supreme` schema tables. Their policy and service access model is outside this Account-specific change; do not modify those tables as part of routine Account hardening.

## Remaining Security Advisor findings

### Leaked password protection

Supabase reports leaked-password protection disabled. The feature requires a paid Supabase plan for this project. The organization is on the Free plan, and no plan upgrade is authorized. Keep the finding documented; do not change billing to clear it.

### SECURITY DEFINER warnings

The six warnings listed above correspond to reviewed functions with intentionally narrow authenticated execution. Re-review their implementation and grants whenever they change. A generic warning is not a reason to remove required application permissions.

### Performance findings

The current performance Advisor reports eight unindexed foreign keys and nine unused indexes in the broader `supreme` schema and private schema. These findings were not modified in this Account release because they require workload-aware index decisions and are not evidence of a demonstrated Account performance defect.

## Required next verification

1. Run authenticated acceptance tests with a dedicated test account for signup/confirmation, username/email login, password recovery, MFA, session listing/revocation, and username changes.
2. Verify production Auth redirect allowlists against the canonical Account URL and approved preview origins.
3. Verify rate limits and abuse behavior on login and recovery flows.
4. Keep phone OTP send/verify disabled until provider delivery and abuse controls pass a controlled test.
5. Re-run Supabase Security and Performance Advisors after any database change.

Do not use a real user's account for destructive tests. Do not weaken grants or add RLS policies just to silence generic lint output.
