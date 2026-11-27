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
grant select, insert, update on public.account_profiles to authenticated;
grant select, insert, update on public.account_business_profiles to authenticated;

drop policy if exists "Account owners manage own profiles" on public.account_profiles;
create policy "Account owners manage own profiles"
on public.account_profiles for all to authenticated
using (exists (
  select 1 from public.account a
  where a.user_id = account_profiles.account_user_id
    and a.user_id = (select auth.uid())
    and a.account_status = 'active'
))
with check (exists (
  select 1 from public.account a
  where a.user_id = account_profiles.account_user_id
    and a.user_id = (select auth.uid())
    and a.account_status = 'active'
));

drop policy if exists "Account owners manage own business profiles" on public.account_business_profiles;
create policy "Account owners manage own business profiles"
on public.account_business_profiles for all to authenticated
using (exists (
  select 1 from public.account_profiles p
  join public.account a on a.user_id = p.account_user_id
  where p.id = account_business_profiles.profile_id
    and a.user_id = (select auth.uid())
    and a.account_status = 'active'
    and p.profile_type = 'business'
))
with check (exists (
  select 1 from public.account_profiles p
  join public.account a on a.user_id = p.account_user_id
  where p.id = account_business_profiles.profile_id
    and a.user_id = (select auth.uid())
    and a.account_status = 'active'
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

commit;
