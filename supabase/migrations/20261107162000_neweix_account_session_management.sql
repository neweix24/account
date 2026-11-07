-- Session inventory and owner-scoped revocation for Neweix Account.
-- A Supabase JWT contains session_id; auth.sessions stores the corresponding session row.

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
  if v_user_id is null or v_current_session_id is null then
    raise exception 'Authentication required' using errcode = '28000';
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
  if v_user_id is null or v_current_session_id is null then
    raise exception 'Authentication required' using errcode = '28000';
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

comment on function public.neweix_list_account_sessions() is
  'Lists only the authenticated account owner sessions; current session is marked.';
comment on function public.neweix_revoke_account_session(uuid) is
  'Revokes one other session belonging to auth.uid(); current session cannot be revoked.';
