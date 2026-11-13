-- Add an auditable security event for each username change.
begin;

alter table private.neweix_account_security_events
  drop constraint if exists neweix_account_security_events_event_type_check;
alter table private.neweix_account_security_events
  add constraint neweix_account_security_events_event_type_check
  check (event_type = any (array[
    'signup','login_success','login_failure','logout','password_reset','password_changed',
    'username_changed','mfa_enabled','mfa_disabled','session_revoked',
    'account_suspended','account_reactivated'
  ]::text[]));

create or replace function public.neweix_change_account_username(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  v_new_username text := lower(trim(coalesce(p_username, '')));
  v_current_username text;
  v_changed_at timestamptz;
  v_reserved_until timestamptz;
begin
  if v_user_id is null or v_session_id is null
     or not public.neweix_validate_current_session() then
    return jsonb_build_object('success', false, 'code', 'session_required');
  end if;
  if v_new_username !~ '^[a-z0-9_]{3,20}$' then
    return jsonb_build_object('success', false, 'code', 'invalid_username');
  end if;
  select a.username, a.username_changed_at into v_current_username, v_changed_at
  from public.account a
  where a.user_id = v_user_id and a.account_status = 'active'
  for update;
  if not found then return jsonb_build_object('success', false, 'code', 'account_unavailable'); end if;
  if v_current_username = v_new_username then return jsonb_build_object('success', false, 'code', 'same_username'); end if;
  if v_changed_at is not null and now() < v_changed_at + interval '30 days' then
    return jsonb_build_object('success', false, 'code', 'cooldown', 'available_at', v_changed_at + interval '30 days');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('neweix-account-username:' || v_new_username, 0));
  if exists (select 1 from public.account a where a.username = v_new_username) then
    return jsonb_build_object('success', false, 'code', 'username_taken');
  end if;
  if exists (select 1 from private.neweix_account_username_reservations r where r.username = v_new_username and r.reserved_until > now()) then
    return jsonb_build_object('success', false, 'code', 'username_reserved');
  end if;
  v_reserved_until := now() + interval '90 days';
  insert into private.neweix_account_username_reservations(username, former_user_id, reserved_until)
  values (v_current_username, v_user_id, v_reserved_until)
  on conflict (username) do update
    set former_user_id = excluded.former_user_id,
        reserved_until = excluded.reserved_until,
        created_at = now()
    where private.neweix_account_username_reservations.reserved_until <= now();
  if not found then return jsonb_build_object('success', false, 'code', 'reservation_conflict'); end if;
  update public.account set username = v_new_username, username_changed_at = now(), updated_at = now()
  where user_id = v_user_id;
  insert into private.neweix_account_security_events(user_id, event_type, metadata)
  values (v_user_id, 'username_changed',
    jsonb_build_object('previous_username', v_current_username,
      'new_username', v_new_username, 'previous_username_reserved_until', v_reserved_until,
      'session_id', v_session_id));
  return jsonb_build_object('success', true, 'username', v_new_username,
    'previous_username_reserved_until', v_reserved_until);
end;
$function$;
commit;
