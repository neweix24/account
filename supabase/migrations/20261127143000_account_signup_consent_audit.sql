-- Record explicit legal consent at account creation without exposing the audit table to clients.
begin;

create table if not exists private.neweix_account_consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null check (consent_type in ('terms_of_service','privacy_policy')),
  policy_version text not null check (policy_version ~ '^[0-9]+[.][0-9]+$'),
  accepted_at timestamptz not null default now(),
  source text not null default 'signup' check (source in ('signup','settings','admin_migration')),
  unique (user_id, consent_type, policy_version)
);

alter table private.neweix_account_consents enable row level security;
revoke all on table private.neweix_account_consents from public, anon, authenticated;

create or replace function private.capture_neweix_signup_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if coalesce(new.raw_user_meta_data ->> 'identity_type', '') = 'customer' then
    if coalesce(new.raw_user_meta_data ->> 'terms_accepted', '') <> 'true'
       or coalesce(new.raw_user_meta_data ->> 'terms_version', '') <> '1.0'
       or coalesce(new.raw_user_meta_data ->> 'privacy_version', '') <> '1.0' then
      raise exception 'Current Neweix terms and privacy consent are required.'
        using errcode = '23514';
    end if;

    insert into private.neweix_account_consents (user_id, consent_type, policy_version)
    values
      (new.id, 'terms_of_service', '1.0'),
      (new.id, 'privacy_policy', '1.0')
    on conflict (user_id, consent_type, policy_version) do nothing;
  end if;
  return new;
end;
$function$;

revoke all on function private.capture_neweix_signup_consent() from public, anon, authenticated;
drop trigger if exists capture_neweix_signup_consent on auth.users;
create trigger capture_neweix_signup_consent
before insert on auth.users
for each row execute function private.capture_neweix_signup_consent();

comment on table private.neweix_account_consents is
  'Private append-only record of versioned customer Terms of Service and Privacy Policy acceptance.';

commit;
),
  accepted_at timestamptz not null default now(),
  source text not null default 'signup' check (source in ('signup','settings','admin_migration')),
  unique (user_id, consent_type, policy_version)
);

alter table private.neweix_account_consents enable row level security;
revoke all on table private.neweix_account_consents from public, anon, authenticated;

create or replace function private.capture_neweix_signup_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if coalesce(new.raw_user_meta_data ->> 'identity_type', '') = 'customer' then
    if coalesce(new.raw_user_meta_data ->> 'terms_accepted', '') <> 'true'
       or coalesce(new.raw_user_meta_data ->> 'terms_version', '') <> '1.0'
       or coalesce(new.raw_user_meta_data ->> 'privacy_version', '') <> '1.0' then
      raise exception 'Current Neweix terms and privacy consent are required.'
        using errcode = '23514';
    end if;

    insert into private.neweix_account_consents (user_id, consent_type, policy_version)
    values
      (new.id, 'terms_of_service', '1.0'),
      (new.id, 'privacy_policy', '1.0')
    on conflict (user_id, consent_type, policy_version) do nothing;
  end if;
  return new;
end;
$function$;

revoke all on function private.capture_neweix_signup_consent() from public, anon, authenticated;
drop trigger if exists capture_neweix_signup_consent on auth.users;
create trigger capture_neweix_signup_consent
before insert on auth.users
for each row execute function private.capture_neweix_signup_consent();

comment on table private.neweix_account_consents is
  'Private append-only record of versioned customer Terms of Service and Privacy Policy acceptance.';

commit;
