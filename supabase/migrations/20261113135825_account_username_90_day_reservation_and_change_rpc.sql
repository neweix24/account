-- Reserve every relinquished username for 90 days and enforce the 30-day change cooldown.
-- Changes are performed only through the authenticated, live-session-validated RPC.

begin;

create table if not exists private.neweix_account_username_reservations (
  username text primary key,
  former_user_id uuid not null,
  reserved_until timestamptz not null,
  created_at timestamptz not null default now(),
  constraint neweix_username_reservation_format
    check (username = lower(username) and username ~ '^[a-z0-9_]{3,20}$')
);

create index if not exists neweix_account_username_reservations_expiry_idx
  on private.neweix_account_username_reservations (reserved_until);

alter table private.neweix_account_username_reservations enable row level security;
revoke all on table private.neweix_account_username_reservations from anon, authenticated, public;

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

  select a.username, a.username_changed_at
    into v_current_username, v_changed_at
  from public.account a
  where a.user_id = v_user_id
    and a.account_status = 'active'
  for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'account_unavailable');
  end if;

  if v_current_username = v_new_username then
    return jsonb_build_object('success', false, 'code', 'same_username');
  end if;

  if v_changed_at is not null and now() < v_changed_at + interval '30 days' then
    return jsonb_build_object('success', false, 'code', 'cooldown',
      'available_at', v_changed_at + interval '30 days');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('neweix-account-username:' || v_new_username, 0));

  if exists (select 1 from public.account a where a.username = v_new_username) then
    return jsonb_build_object('success', false, 'code', 'username_taken');
  end if;

  if exists (
    select 1 from private.neweix_account_username_reservations r
    where r.username = v_new_username and r.reserved_until > now()
  ) then
    return jsonb_build_object('success', false, 'code', 'username_reserved');
  end if;

  v_reserved_until := now() + interval '90 days';

  insert into private.neweix_account_username_reservations
    (username, former_user_id, reserved_until)
  values (v_current_username, v_user_id, v_reserved_until)
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

  return jsonb_build_object('success', true, 'username', v_new_username,
    'previous_username_reserved_until', v_reserved_until);
end;
$function$;

revoke all on function public.neweix_change_account_username(text) from public, anon;
grant execute on function public.neweix_change_account_username(text) to authenticated;

commit;
