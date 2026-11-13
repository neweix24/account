-- Align the canonical Account username storage with the approved 3–20 character policy.
-- Username changes must go through a dedicated server-side operation so cooldown and
-- old-name reservation rules cannot be bypassed with a direct PostgREST update.

begin;

alter table public.account
  drop constraint if exists neweix_accounts_username_format;

alter table public.account
  drop constraint if exists account_username_policy_check;

alter table public.account
  add constraint account_username_policy_check
  check (
    username = lower(username)
    and username ~ '^[a-z0-9_]{3,20}$'
  );

alter table public.account
  add column if not exists username_changed_at timestamptz;

comment on column public.account.username_changed_at is
  'Timestamp of the last user-initiated username change. Controlled only by the Account username-change operation.';

revoke update (username) on table public.account from authenticated;

commit;
