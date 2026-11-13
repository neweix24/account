-- Permit the former owner to reclaim their own username during its 90-day reservation.
-- Other accounts remain blocked. The 30-day change cooldown still applies.

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
  v_reserved_owner uuid;
  v_target_reserved_until timestamptz;
begin
  if v_user_id is null or v_session_id is null
     or not public.neweix_validate_current_session() then
    return jsonb_build_object('success', false, 'code', 'session_required');
  end if;

  if v_new_username !~ '^[a-z0-9_]{3,20}$' then
    return jsonb_build_object('success', false, 'code', 'invalid_username');
  end if;

  select a.username, a.username_changed_at
    into v_current_username, v_changed_at
  from public.account a
  where a.user_id = v_user_id and a.account_status = 'active'
  for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'account_unavailable');
  end if;

  if v_current_username = v_new_username then
    return jsonb_build_object('success', false, 'code', 'same_username');
  end if;

  if v_changed_at is not null and now() < v_changed_at + interval '30 days' then
    return jsonb_build_object(
      'success', false,
      'code', 'cooldown',
      'available_at', v_changed_at + interval '30 days'
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('neweix-account-username:' || v_new_username, 0)
  );

  if exists (
    select 1 from public.account a where a.username = v_new_username
  ) then
    return jsonb_build_object('success', false, 'code', 'username_taken');
  end if;

  select r.former_user_id, r.reserved_until
    into v_reserved_owner, v_target_reserved_until
  from private.neweix_account_username_reservations r
  where r.username = v_new_username
  for update;

  if found then
    if v_target_reserved_until > now() and v_reserved_owner <> v_user_id then
      return jsonb_build_object('success', false, 'code', 'username_reserved');
    end if;

    -- Expired reservation or a reservation belonging to this same user.
    delete from private.neweix_account_username_reservations
    where username = v_new_username;
  end if;

  v_reserved_until := now() + interval '90 days';

  insert into private.neweix_account_username_reservations
    (username, former_user_id, reserved_until)
  values
    (v_current_username, v_user_id, v_reserved_until)
  on conflict (username) do update
    set former_user_id = excluded.former_user_id,
        reserved_until = excluded.reserved_until,
        created_at = now()
    where private.neweix_account_username_reservations.reserved_until <= now();

  if not found then
    return jsonb_build_object('success', false, 'code', 'reservation_conflict');
  end if;

  update public.account
  set username = v_new_username,
      username_changed_at = now(),
      updated_at = now()
  where user_id = v_user_id;

  insert into private.neweix_account_security_events(user_id, event_type, metadata)
  values (
    v_user_id,
    'username_changed',
    jsonb_build_object(
      'previous_username', v_current_username,
      'new_username', v_new_username,
      'previous_username_reserved_until', v_reserved_until,
      'session_id', v_session_id,
      'reclaimed_previous_username', v_reserved_owner = v_user_id
    )
  );

  return jsonb_build_object(
    'success', true,
    'username', v_new_username,
    'previous_username_reserved_until', v_reserved_until
  );
end;
$function$;

revoke all on function public.neweix_change_account_username(text) from public, anon;
grant execute on function public.neweix_change_account_username(text) to authenticated;
