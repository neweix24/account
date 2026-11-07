create schema if not exists private;

create table if not exists public.neweix_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  full_name text,
  display_name text,
  avatar_url text,
  date_of_birth date,
  preferred_language text not null default 'en',
  account_status text not null default 'active' check (account_status in ('active','suspended','closed')),
  email text,
  phone text,
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint neweix_accounts_username_format check (username = lower(username) and username ~ '^[a-z0-9_][a-z0-9_.-]{2,29}$'),
  constraint neweix_accounts_avatar_https check (avatar_url is null or avatar_url ~ '^https://'),
  constraint neweix_accounts_language_format check (preferred_language ~ '^[a-z]{2}(-[A-Z]{2})?$')
);
create unique index if not exists neweix_accounts_username_lower_uidx on public.neweix_accounts (lower(username));
create unique index if not exists neweix_accounts_email_lower_uidx on public.neweix_accounts (lower(email)) where email is not null;
create unique index if not exists neweix_accounts_phone_uidx on public.neweix_accounts (phone) where phone is not null;

create table if not exists private.neweix_service_clients (
  client_id text primary key check (client_id ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
  display_name text not null,
  redirect_uris text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists private.neweix_account_service_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references private.neweix_service_clients(client_id) on delete cascade,
  access_status text not null default 'allowed' check (access_status in ('allowed','blocked','pending')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, client_id)
);
create table if not exists private.neweix_account_security_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('signup','login_success','login_failure','logout','password_reset','mfa_enabled','mfa_disabled','session_revoked','account_suspended','account_reactivated')),
  client_id text,
  ip_hash text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists private.neweix_account_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text,
  device_fingerprint_hash text not null,
  trusted_at timestamptz,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, device_fingerprint_hash)
);
create index if not exists neweix_account_security_events_user_created_idx on private.neweix_account_security_events(user_id, created_at desc);
create index if not exists neweix_account_devices_user_idx on private.neweix_account_devices(user_id, last_seen_at desc);
create index if not exists neweix_account_service_access_client_idx on private.neweix_account_service_access(client_id, access_status);

alter table public.neweix_accounts enable row level security;
revoke all on public.neweix_accounts from anon, authenticated;
grant select on public.neweix_accounts to authenticated;
grant update (username, full_name, display_name, avatar_url, date_of_birth, preferred_language) on public.neweix_accounts to authenticated;
drop policy if exists "Account owner can read own central account" on public.neweix_accounts;
create policy "Account owner can read own central account" on public.neweix_accounts for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Account owner can update safe profile fields" on public.neweix_accounts;
create policy "Account owner can update safe profile fields" on public.neweix_accounts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function private.set_neweix_account_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end; $$;
drop trigger if exists neweix_accounts_updated_at on public.neweix_accounts;
create trigger neweix_accounts_updated_at before update on public.neweix_accounts for each row execute function private.set_neweix_account_updated_at();

create or replace function private.provision_neweix_account()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare candidate_username text;
begin
  candidate_username := lower(coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), 'user_' || substr(replace(new.id::text, '-', ''), 1, 12)));
  if candidate_username !~ '^[a-z0-9_][a-z0-9_.-]{2,29}$' then candidate_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 12); end if;
  insert into public.neweix_accounts (user_id, username, full_name, display_name, email, phone, email_verified_at, phone_verified_at)
  values (new.id, candidate_username, nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'display_name', ''), new.email, new.phone, new.email_confirmed_at, new.phone_confirmed_at)
  on conflict (user_id) do update set email = excluded.email, phone = excluded.phone, email_verified_at = excluded.email_verified_at, phone_verified_at = excluded.phone_verified_at;
  return new;
end;
$$;
revoke all on function private.provision_neweix_account() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_neweix_account on auth.users;
create trigger on_auth_user_created_neweix_account after insert or update of email, phone, email_confirmed_at, phone_confirmed_at on auth.users for each row execute function private.provision_neweix_account();

insert into public.neweix_accounts (user_id, username, full_name, email, phone, email_verified_at, phone_verified_at)
select u.id, 'user_' || substr(replace(u.id::text, '-', ''), 1, 12), nullif(u.raw_user_meta_data ->> 'full_name', ''), u.email, u.phone, u.email_confirmed_at, u.phone_confirmed_at
from auth.users u on conflict (user_id) do update set email = excluded.email, phone = excluded.phone, email_verified_at = excluded.email_verified_at, phone_verified_at = excluded.phone_verified_at;

comment on table public.neweix_accounts is 'Central Neweix identity profile. Supabase Auth remains the credential authority; service-specific authorization is stored separately.';
comment on table private.neweix_service_clients is 'Registry of first-party Neweix services allowed to integrate with central identity.';
comment on table private.neweix_account_service_access is 'Per-account access decisions for registered first-party Neweix services.';
comment on table private.neweix_account_security_events is 'Private audit trail for central account security events. Never expose directly to client roles.';
comment on table private.neweix_account_devices is 'Private device trust registry. Store only one-way device fingerprint hashes.';
