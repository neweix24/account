-- Consolidate the legacy customer profile and central identity into public.account.
-- Preserve Auth users, credentials, sessions, MFA factors, usernames and existing profile fields.
-- Eixon-owned routines and their compatibility dependency are intentionally left untouched.
begin;

alter table public.neweix_accounts rename to account;
alter index if exists public.neweix_accounts_username_lower_uidx rename to account_username_lower_uidx;
alter index if exists public.neweix_accounts_email_lower_uidx rename to account_email_lower_uidx;
alter index if exists public.neweix_accounts_phone_uidx rename to account_phone_uidx;
alter table public.account add column if not exists public_id text;
create unique index if not exists account_public_id_uidx on public.account(public_id) where public_id is not null;

create or replace function public.neweix_generate_public_id(p_prefix text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bytes bytea;
  v_suffix text;
  v_candidate text;
  i integer;
begin
  if p_prefix not in ('a', 'eix:a') then
    raise exception 'Unsupported Account ID prefix';
  end if;
  loop
    v_bytes := extensions.gen_random_bytes(12);
    v_suffix := '';
    for i in 0..11 loop
      v_suffix := v_suffix || pg_catalog.substr(
        '0123456789abcdefghijklmnopqrstuvwxyz',
        (pg_catalog.get_byte(v_bytes, i) % 36) + 1, 1
      );
    end loop;
    v_candidate := p_prefix || v_suffix;
    if p_prefix = 'a' then
      if not exists (select 1 from public.account a where a.public_id = v_candidate) then
        return v_candidate;
      end if;
    else
      -- Temporary compatibility for the legacy customer_profiles table.
      if not exists (select 1 from public.customer_profiles cp where cp.public_id = v_candidate) then
        return v_candidate;
      end if;
    end if;
  end loop;
end;
$$;
revoke all on function public.neweix_generate_public_id(text) from public, anon, authenticated;

-- Supreme is a separate identity system, not a Neweix Account or employee.
-- Keep its Auth identity intact, but remove any legacy Account/profile/device/access rows.
delete from private.neweix_account_service_access sa
using supreme.identities si
where sa.user_id = si.user_id;

delete from private.neweix_account_devices d
using supreme.identities si
where d.user_id = si.user_id;

delete from public.account a
using supreme.identities si
where a.user_id = si.user_id;

delete from public.customer_profiles cp
using supreme.identities si
where cp.user_id = si.user_id;

-- Merge the old profile fields into the canonical Account row without resetting usernames
-- or deleting existing central identity data. Existing Auth UUIDs and credentials are unchanged.
-- Supreme identities are explicitly excluded.
update public.account a
set
  public_id = coalesce(a.public_id, public.neweix_generate_public_id('a')),
  full_name = coalesce(a.full_name, nullif(cp.full_name, ''), nullif(u.raw_user_meta_data ->> 'full_name', '')),
  display_name = coalesce(a.display_name, nullif(cp.display_name, ''), nullif(u.raw_user_meta_data ->> 'display_name', '')),
  avatar_url = coalesce(a.avatar_url, cp.avatar_url, nullif(u.raw_user_meta_data ->> 'avatar_url', '')),
  date_of_birth = coalesce(a.date_of_birth, cp.date_of_birth),
  preferred_language = coalesce(nullif(cp.preferred_language, ''), a.preferred_language, 'en'),
  email = u.email,
  phone = coalesce(u.phone, a.phone, cp.phone),
  email_verified_at = coalesce(u.email_confirmed_at, a.email_verified_at),
  phone_verified_at = case
    when u.phone is not null and u.phone = coalesce(u.phone, a.phone, cp.phone)
      then coalesce(u.phone_confirmed_at, a.phone_verified_at, cp.phone_verified_at)
    when a.phone is not null and a.phone = cp.phone
      then coalesce(a.phone_verified_at, cp.phone_verified_at)
    else coalesce(u.phone_confirmed_at, a.phone_verified_at)
  end,
  updated_at = now()
from auth.users u
left join public.customer_profiles cp on cp.user_id = u.id
where a.user_id = u.id
  and not exists (select 1 from supreme.identities si where si.user_id = u.id);

-- Provision any Auth user that predates the central identity table.
insert into public.account (
  user_id, public_id, username, full_name, display_name, avatar_url, date_of_birth,
  preferred_language, account_status, email, phone, email_verified_at,
  phone_verified_at, created_at, updated_at
)
select
  u.id,
  public.neweix_generate_public_id('a'),
  'user_' || substr(replace(u.id::text, '-', ''), 1, 12),
  coalesce(nullif(cp.full_name, ''), nullif(u.raw_user_meta_data ->> 'full_name', '')),
  coalesce(nullif(cp.display_name, ''), nullif(u.raw_user_meta_data ->> 'display_name', '')),
  coalesce(cp.avatar_url, nullif(u.raw_user_meta_data ->> 'avatar_url', '')),
  cp.date_of_birth,
  coalesce(nullif(cp.preferred_language, ''), 'en'),
  'active',
  u.email,
  coalesce(u.phone, cp.phone),
  u.email_confirmed_at,
  coalesce(u.phone_confirmed_at, cp.phone_verified_at),
  coalesce(u.created_at, now()),
  now()
from auth.users u
left join public.customer_profiles cp on cp.user_id = u.id
where not exists (select 1 from public.account a where a.user_id = u.id)
  and not exists (select 1 from supreme.identities si where si.user_id = u.id)
  and coalesce(u.raw_user_meta_data ->> 'identity_type', '') = 'customer'
on conflict (user_id) do nothing;

create or replace function private.provision_neweix_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_username text;
begin
  -- Supreme owns its own identity lifecycle and must never receive a Neweix Account row.
  if exists (select 1 from supreme.identities si where si.user_id = new.id) then
    return new;
  end if;

  -- Only the customer signup flow may create a Neweix Account profile.
  -- Existing customer rows continue to be synchronized on Auth email/phone updates.
  if not exists (select 1 from public.account a where a.user_id = new.id)
     and coalesce(new.raw_user_meta_data ->> 'identity_type', '') <> 'customer' then
    return new;
  end if;

  candidate_username := lower(coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    'user_' || substr(replace(new.id::text, '-', ''), 1, 12)
  ));
  if candidate_username !~ '^[a-z0-9_][a-z0-9_.-]{2,29}$' then
    candidate_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 12);
  end if;
  insert into public.account (
    user_id, public_id, username, full_name, display_name, email, phone,
    email_verified_at, phone_verified_at
  ) values (
    new.id, public.neweix_generate_public_id('a'), candidate_username,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    new.email, new.phone, new.email_confirmed_at, new.phone_confirmed_at
  )
  on conflict (user_id) do update set
    email = excluded.email,
    phone = excluded.phone,
    email_verified_at = excluded.email_verified_at,
    phone_verified_at = excluded.phone_verified_at;
  return new;
end;
$$;

-- Also handle the case where Supreme creates its Auth user first and inserts its
-- supreme.identities row afterwards: remove any transient Account-side records.
create or replace function private.exclude_supreme_identity_from_neweix_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    delete from private.neweix_account_service_access where user_id = old.user_id;
    delete from private.neweix_account_devices where user_id = old.user_id;
    delete from public.account where user_id = old.user_id;
    delete from public.customer_profiles where user_id = old.user_id;
  end if;

  delete from private.neweix_account_service_access where user_id = new.user_id;
  delete from private.neweix_account_devices where user_id = new.user_id;
  delete from public.account where user_id = new.user_id;
  delete from public.customer_profiles where user_id = new.user_id;
  return new;
end;
$$;

revoke all on function private.exclude_supreme_identity_from_neweix_account() from public, anon, authenticated;
drop trigger if exists exclude_supreme_identity_from_neweix_account on supreme.identities;
create trigger exclude_supreme_identity_from_neweix_account
after insert or update of user_id on supreme.identities
for each row execute function private.exclude_supreme_identity_from_neweix_account();

-- Record login security events through a service-role-only RPC. Raw identifiers and IPs are never stored.
create or replace function public.neweix_record_login_security_event(
  p_user_id uuid,
  p_event_type text,
  p_ip_hash text default null,
  p_user_agent text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_event_type not in ('login_success', 'login_failure') then
    raise exception 'Unsupported Account login event type';
  end if;

  insert into private.neweix_account_security_events (
    user_id, event_type, ip_hash, user_agent, metadata
  )
  values (
    p_user_id,
    p_event_type,
    left(p_ip_hash, 64),
    left(p_user_agent, 512),
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.neweix_record_login_security_event(uuid, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.neweix_record_login_security_event(uuid, text, text, text, jsonb)
  to service_role;

comment on function public.neweix_record_login_security_event(uuid, text, text, text, jsonb)
  is 'Service-role-only writer for Account login audit events; stores only hashed IP data and non-sensitive metadata.';

-- Redirect Account-owned SQL routines that depended on the old customer profile table.
-- Eixon-owned eixpay routines remain untouched and continue to use their compatibility data
-- until the Eixon repository migrates them independently.
do $$
declare
  r record;
  v_definition text;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prokind = 'f'
      and n.nspname in ('public', 'private')
      and p.proname not like 'eixpay_%'
      and p.proname <> 'neweix_generate_public_id'
      and pg_get_functiondef(p.oid) ilike '%customer_profiles%'
  loop
    v_definition := pg_get_functiondef(r.oid);
    v_definition := replace(v_definition, 'public.customer_profiles', 'public.account');
    -- Phone verification updates the canonical row; it must not insert an incomplete profile.
    v_definition := replace(v_definition,
      E'  begin\n    insert into public.account (\n      user_id, phone, phone_verified_at, updated_at\n    )\n    values (p_user_id, p_phone, pg_catalog.now(), pg_catalog.now())\n    on conflict (user_id) do update\n      set phone = excluded.phone,\n          phone_verified_at = pg_catalog.now(),\n          updated_at = pg_catalog.now();\n  exception',
      E'  begin\n    update public.account\n       set phone = p_phone,\n           phone_verified_at = pg_catalog.now(),\n           updated_at = pg_catalog.now()\n     where user_id = p_user_id;\n    if not found then return ''account_not_found''; end if;\n  exception'
    );
    execute v_definition;
  end loop;
end;
$$;

comment on table public.account is
  'Canonical Neweix Account identity profile. Supabase Auth remains the credential authority; service-specific authorization is stored separately.';
comment on column public.account.public_id is
  'Unique public Account identifier with the a prefix. Employee and Supreme identities are owned by their separate identity systems.';

-- Refresh PostgREST after the canonical table rename so the login function sees public.account.
notify pgrst, 'reload schema';

commit;
