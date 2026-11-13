-- Enforce the Account username policy and 90-day reservation rule on every
-- provisioning path, including the auth.users provisioning trigger.

create or replace function private.guard_neweix_account_username_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if exists (
    select 1
    from private.neweix_account_username_reservations r
    where r.username = new.username
      and r.reserved_until > now()
      and r.former_user_id <> new.user_id
  ) then
    raise exception 'This username is reserved for its former owner.'
      using errcode = '23505';
  end if;

  return new;
end;
$function$;

revoke all on function private.guard_neweix_account_username_reservation()
  from public, anon, authenticated;

drop trigger if exists neweix_account_username_reservation_guard on public.account;
create trigger neweix_account_username_reservation_guard
before insert or update of username on public.account
for each row
execute function private.guard_neweix_account_username_reservation();

create or replace function private.provision_neweix_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  candidate_username text;
begin
  -- Supreme owns its own identity lifecycle and must never receive a Neweix Account row.
  if exists (select 1 from supreme.identities si where si.user_id = new.id) then
    return new;
  end if;

  -- Existing customer rows only need contact fields synchronized.
  if exists (select 1 from public.account a where a.user_id = new.id) then
    update public.account
    set email = new.email,
        phone = new.phone,
        email_verified_at = new.email_confirmed_at,
        phone_verified_at = new.phone_confirmed_at
    where user_id = new.id;
    return new;
  end if;

  -- Only the customer signup flow may create a Neweix Account profile.
  if coalesce(new.raw_user_meta_data ->> 'identity_type', '') <> 'customer' then
    return new;
  end if;

  candidate_username := lower(nullif(trim(new.raw_user_meta_data ->> 'username'), ''));

  -- Preserve the existing safe fallback for internal customer provisioning
  -- that does not supply a username, but never silently rewrite invalid input.
  if candidate_username is null then
    candidate_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 12);
  elsif candidate_username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Username must be 3 to 20 lowercase letters, numbers, or underscores.'
      using errcode = '23514';
  end if;

  insert into public.account (
    user_id, public_id, username, full_name, display_name, email, phone,
    email_verified_at, phone_verified_at
  ) values (
    new.id, public.neweix_generate_public_id('a'), candidate_username,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    new.email, new.phone, new.email_confirmed_at, new.phone_confirmed_at
  );

  return new;
end;
$function$;
