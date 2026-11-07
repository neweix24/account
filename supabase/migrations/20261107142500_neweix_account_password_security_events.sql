-- Record successful password changes in the private Account security audit trail.
alter table private.neweix_account_security_events
  drop constraint if exists neweix_account_security_events_event_type_check;

alter table private.neweix_account_security_events
  add constraint neweix_account_security_events_event_type_check
  check (event_type in (
    'signup',
    'login_success',
    'login_failure',
    'logout',
    'password_reset',
    'password_changed',
    'mfa_enabled',
    'mfa_disabled',
    'session_revoked',
    'account_suspended',
    'account_reactivated'
  ));

create or replace function public.neweix_record_password_changed_event()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id text := auth.jwt() ->> 'session_id';
begin
  if v_user_id is null or v_session_id is null
     or not public.neweix_validate_current_session() then
    raise exception 'Active authenticated session required' using errcode = '28000';
  end if;

  insert into private.neweix_account_security_events (user_id, event_type, metadata)
  values (
    v_user_id,
    'password_changed',
    jsonb_build_object('session_id', v_session_id)
  );

  return true;
end;
$$;

revoke all on function public.neweix_record_password_changed_event() from public, anon;
grant execute on function public.neweix_record_password_changed_event() to authenticated;

comment on function public.neweix_record_password_changed_event() is
  'Writes a password_changed audit event for the authenticated user only when the current JWT session is still live.';
