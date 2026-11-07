-- Consolidate the legacy customer profile and central identity into public.account.
-- Auth users, credentials, sessions, MFA factors and service-owned business data are preserved.
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
  if p_prefix <> 'a' then
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
    if not exists (select 1 from public.account a where a.public_id = v_candidate) then
      return v_candidate;
    end if;
  end loop;
end;
$$;

-- Old profile rows are intentionally discarded as requested. Keep auth.users and credentials.
delete from public.account;
insert into public.account (
  user_id, public_id, username, email, phone, email_verified_at, phone_verified_at,
  preferred_language, account_status, created_at, updated_at
)
select
  u.id,
  public.neweix_generate_public_id('a'),
  'user_' || substr(replace(u.id::text, '-', ''), 1, 12),
  u.email,
  u.phone,
  u.email_confirmed_at,
  u.phone_confirmed_at,
  'en',
  'active',
  coalesce(u.created_at, now()),
  now()
from auth.users u;

create or replace function private.provision_neweix_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_username text;
begin
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

-- Redirect every existing SQL routine that depended on the old customer profile table.
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
      and pg_get_functiondef(p.oid) ilike '%customer_profiles%'
  loop
    v_definition := pg_get_functiondef(r.oid);
    v_definition := replace(v_definition, 'public.customer_profiles', 'public.account');
    -- The central Account row already exists at phone-verification time.
    -- Update it in place; inserting a partial row would violate required username/public_id.
    v_definition := replace(v_definition,
      E'  begin\n    insert into public.account (\n      user_id, phone, phone_verified_at, updated_at\n    )\n    values (p_user_id, p_phone, pg_catalog.now(), pg_catalog.now())\n    on conflict (user_id) do update\n      set phone = excluded.phone,\n          phone_verified_at = pg_catalog.now(),\n          updated_at = pg_catalog.now();\n  exception',
      E'  begin\n    update public.account\n       set phone = p_phone,\n           phone_verified_at = pg_catalog.now(),\n           updated_at = pg_catalog.now()\n     where user_id = p_user_id;\n    if not found then return ''account_not_found''; end if;\n  exception'
    );
    v_definition := replace(v_definition,
      E'not exists (\n    select 1 from public.staff_profiles\n    where user_id = v_actor and role = ''supreme'' and is_active = true\n  )',
      'not private.has_staff_role(array[''supreme'']::text[])'
    );
    execute v_definition;
  end loop;
end;
$$;

-- Keep the legacy profile relation temporarily for external service consumers.
-- The Account repository does not migrate or modify Eixon-owned routines/data.
-- Remove this compatibility table only after every external service has migrated its own code to public.account.

comment on table public.account is
  'Canonical Neweix Account identity profile. Supabase Auth remains the credential authority; service-specific authorization is stored separately.';
comment on column public.account.public_id is
  'Unique public Account identifier. Employee and Supreme identities are owned by their separate identity systems.';

commit;
