-- Multiple Personal and Business Profiles under one canonical Neweix Account.
-- One Account continues to own exactly one Eixon Wallet; profiles never own wallets.
begin;

create table if not exists public.account_profiles (
  id uuid primary key default gen_random_uuid(),
  account_user_id uuid not null references public.account(user_id) on delete cascade,
  profile_type text not null check (profile_type in ('personal','business')),
  display_name text not null check (char_length(display_name) between 1 and 100),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  profile_status text not null default 'active' check (profile_status in ('active','limited','suspended','archived')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists account_profiles_one_personal_uidx
  on public.account_profiles(account_user_id) where profile_type = 'personal';
create unique index if not exists account_profiles_one_default_uidx
  on public.account_profiles(account_user_id) where is_default;
create index if not exists account_profiles_account_created_idx
  on public.account_profiles(account_user_id, created_at);

create table if not exists public.account_business_profiles (
  profile_id uuid primary key references public.account_profiles(id) on delete cascade,
  business_name text not null check (char_length(business_name) between 2 and 120),
  business_category text,
  public_email text,
  public_phone text,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','pending','verified','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_profiles enable row level security;
alter table public.account_business_profiles enable row level security;
revoke all on public.account_profiles, public.account_business_profiles from anon;
grant select, insert on public.account_profiles to authenticated;
grant update (display_name, avatar_url, is_default) on public.account_profiles to authenticated;
grant select, insert on public.account_business_profiles to authenticated;
grant update (business_name, business_category, public_email, public_phone) on public.account_business_profiles to authenticated;

drop policy if exists "Account owners manage own profiles" on public.account_profiles;
create policy "Account owners manage own profiles"
on public.account_profiles for select to authenticated
using (exists (
  select 1 from public.account a
  where a.user_id = account_profiles.account_user_id
    and a.user_id = (select auth.uid())
    and a.account_status = 'active'
));

drop policy if exists "Account owners manage own business profiles" on public.account_business_profiles;
create policy "Account owners manage own business profiles"
on public.account_business_profiles for select to authenticated
using (exists (
  select 1 from public.account_profiles p
  join public.account a on a.user_id = p.account_user_id
  where p.id = account_business_profiles.profile_id
    and a.user_id = (select auth.uid())
    and a.account_status = 'active'
    and p.profile_type = 'business'
));


drop policy if exists "Account owners insert own business profiles" on public.account_profiles;
create policy "Account owners insert own business profiles"
on public.account_profiles for insert to authenticated
with check (
  account_user_id = (select auth.uid())
  and profile_type = 'business'
  and profile_status = 'active'
  and is_default = false
  and exists (select 1 from public.account a where a.user_id = account_profiles.account_user_id and a.account_status = 'active')
);

drop policy if exists "Account owners update own profiles" on public.account_profiles;
create policy "Account owners update own profiles"
on public.account_profiles for update to authenticated
using (account_user_id = (select auth.uid()))
with check (account_user_id = (select auth.uid()));

drop policy if exists "Account owners insert own business details" on public.account_business_profiles;
create policy "Account owners insert own business details"
on public.account_business_profiles for insert to authenticated
with check (exists (
  select 1 from public.account_profiles p
  join public.account a on a.user_id = p.account_user_id
  where p.id = account_business_profiles.profile_id
    and p.account_user_id = (select auth.uid())
    and p.profile_type = 'business'
    and a.account_status = 'active'
));

drop policy if exists "Account owners update own business details" on public.account_business_profiles;
create policy "Account owners update own business details"
on public.account_business_profiles for update to authenticated
using (exists (
  select 1 from public.account_profiles p
  where p.id = account_business_profiles.profile_id
    and p.account_user_id = (select auth.uid())
    and p.profile_type = 'business'
))
with check (exists (
  select 1 from public.account_profiles p
  where p.id = account_business_profiles.profile_id
    and p.account_user_id = (select auth.uid())
    and p.profile_type = 'business'
));

create or replace function private.set_account_profile_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
revoke all on function private.set_account_profile_updated_at() from public, anon, authenticated;

drop trigger if exists account_profiles_updated_at on public.account_profiles;
create trigger account_profiles_updated_at before update on public.account_profiles
for each row execute function private.set_account_profile_updated_at();
drop trigger if exists account_business_profiles_updated_at on public.account_business_profiles;
create trigger account_business_profiles_updated_at before update on public.account_business_profiles
for each row execute function private.set_account_profile_updated_at();

-- Backfill one Personal Profile for every existing active Account; never create wallets here.
insert into public.account_profiles(account_user_id, profile_type, display_name, avatar_url, is_default)
select a.user_id, 'personal',
       coalesce(nullif(a.display_name, ''), nullif(a.full_name, ''), a.username),
       a.avatar_url, true
from public.account a
where a.account_status = 'active'
on conflict (account_user_id) where profile_type = 'personal' do nothing;


create or replace function public.neweix_create_business_profile(
  p_business_name text,
  p_business_category text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_business_name is null or pg_catalog.char_length(pg_catalog.btrim(p_business_name)) not between 2 and 120 then
    raise exception 'Business name must be 2 to 120 characters' using errcode = '22023';
  end if;
  if p_business_category is not null and pg_catalog.char_length(pg_catalog.btrim(p_business_category)) > 80 then
    raise exception 'Business category is too long' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.account a
    where a.user_id = v_user_id and a.account_status = 'active'
  ) then
    raise exception 'Active Neweix Account required' using errcode = '42501';
  end if;

  insert into public.account_profiles(account_user_id, profile_type, display_name, is_default)
  values (v_user_id, 'business', pg_catalog.btrim(p_business_name), false)
  returning id into v_profile_id;

  insert into public.account_business_profiles(profile_id, business_name, business_category)
  values (v_profile_id, pg_catalog.btrim(p_business_name), nullif(pg_catalog.btrim(coalesce(p_business_category, '')), ''));

  return v_profile_id;
end;
$function$;
revoke all on function public.neweix_create_business_profile(text, text) from public, anon;
grant execute on function public.neweix_create_business_profile(text, text) to authenticated;

create or replace function public.neweix_set_default_profile(p_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.account_profiles p
    where p.id = p_profile_id
      and p.account_user_id = v_user_id
      and p.profile_status = 'active'
  ) then
    raise exception 'Profile not found or unavailable' using errcode = '42501';
  end if;
  update public.account_profiles p
     set is_default = false
   where p.account_user_id = v_user_id
     and p.profile_status = 'active'
     and p.is_default = true;
  update public.account_profiles p
     set is_default = true
   where p.id = p_profile_id
     and p.account_user_id = v_user_id
     and p.profile_status = 'active';
  return true;
end;
$function$;
revoke all on function public.neweix_set_default_profile(uuid) from public, anon;
grant execute on function public.neweix_set_default_profile(uuid) to authenticated;


create or replace function private.create_default_neweix_personal_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.account_profiles(account_user_id, profile_type, display_name, avatar_url, is_default)
  values (
    new.user_id, 'personal',
    coalesce(nullif(new.display_name, ''), nullif(new.full_name, ''), new.username),
    new.avatar_url, true
  )
  on conflict (account_user_id) where profile_type = 'personal' do nothing;
  return new;
end;
$function$;
revoke all on function private.create_default_neweix_personal_profile() from public, anon, authenticated;
drop trigger if exists create_default_neweix_personal_profile on public.account;
create trigger create_default_neweix_personal_profile
after insert on public.account
for each row execute function private.create_default_neweix_personal_profile();

create or replace function private.sync_neweix_signup_language()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_language text := new.raw_user_meta_data ->> 'preferred_language';
begin
  if v_language in ('en', 'bn') then
    update public.account
       set preferred_language = v_language,
           updated_at = pg_catalog.now()
     where user_id = new.id;
  end if;
  return new;
end;
$function$;
revoke all on function private.sync_neweix_signup_language() from public, anon, authenticated;
drop trigger if exists zz_sync_neweix_signup_language on auth.users;
create trigger zz_sync_neweix_signup_language
after insert on auth.users
for each row execute function private.sync_neweix_signup_language();

commit;
