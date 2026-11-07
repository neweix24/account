-- Require a live session for every Account session-management RPC and profile RLS read/write.
-- This also blocks direct Data API use of a revoked-but-not-yet-expired JWT.

create or replace function public.neweix_validate_current_session()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
  if v_user_id is null or v_session_id is null then
    return false;
  end if;

  return exists (
    select 1
    from auth.sessions s
    where s.id = v_session_id
      and s.user_id = v_user_id
      and (s.not_after is null or s.not_after > now())
  );
end;
$$;

revoke all on function public.neweix_validate_current_session() from public, anon;
grant execute on function public.neweix_validate_current_session() to authenticated;

create or replace function public.neweix_list_account_sessions()
returns table (
  session_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  refreshed_at timestamp without time zone,
  user_agent text,
  assurance_level text,
  is_current boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_session_id uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
  if v_user_id is null or v_current_session_id is null
     or not public.neweix_validate_current_session() then
    raise exception 'Active authenticated session required' using errcode = '28000';
  end if;

  return query
  select s.id, s.created_at, s.updated_at, s.refreshed_at,
         s.user_agent, s.aal::text, (s.id = v_current_session_id)
  from auth.sessions s
  where s.user_id = v_user_id
    and (s.not_after is null or s.not_after > now())
  order by s.updated_at desc nulls last, s.created_at desc;
end;
$$;

revoke all on function public.neweix_list_account_sessions() from public, anon;
grant execute on function public.neweix_list_account_sessions() to authenticated;

create or replace function public.neweix_revoke_account_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_session_id uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  v_deleted integer := 0;
begin
  if v_user_id is null or v_current_session_id is null
     or not public.neweix_validate_current_session() then
    raise exception 'Active authenticated session required' using errcode = '28000';
  end if;
  if p_session_id is null or p_session_id = v_current_session_id then
    raise exception 'The current session cannot be revoked here' using errcode = '22023';
  end if;

  delete from auth.sessions
  where id = p_session_id and user_id = v_user_id;
  get diagnostics v_deleted = row_count;

  if v_deleted > 0 then
    insert into private.neweix_account_security_events (user_id, event_type, metadata)
    values (v_user_id, 'session_revoked', jsonb_build_object('session_id', p_session_id));
  end if;

  return v_deleted > 0;
end;
$$;

revoke all on function public.neweix_revoke_account_session(uuid) from public, anon;
grant execute on function public.neweix_revoke_account_session(uuid) to authenticated;

drop policy if exists "Account owner can read own central account" on public.neweix_accounts;
create policy "Account owner can read own central account"
on public.neweix_accounts
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.neweix_validate_current_session())
);

drop policy if exists "Account owner can update safe profile fields" on public.neweix_accounts;
create policy "Account owner can update safe profile fields"
on public.neweix_accounts
for update
to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.neweix_validate_current_session())
)
with check (
  (select auth.uid()) = user_id
  and (select public.neweix_validate_current_session())
);

comment on function public.neweix_validate_current_session() is
  'Returns true only when the caller JWT session_id still exists for auth.uid() and has not passed not_after. Used by the proxy, Account RPCs and profile RLS.';
