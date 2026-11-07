create table if not exists private.neweix_login_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null,
  attempt_count integer not null check (attempt_count >= 1),
  updated_at timestamptz not null default now()
);
alter table private.neweix_login_rate_limits enable row level security;
revoke all on private.neweix_login_rate_limits from public, anon, authenticated;

create or replace function public.neweix_consume_login_rate_limit(
  p_identifier_hash text,
  p_ip_hash text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_identifier_count integer;
  v_ip_count integer;
begin
  if p_identifier_hash !~ '^[a-f0-9]{64}$' or p_ip_hash !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  insert into private.neweix_login_rate_limits(rate_key, window_started_at, attempt_count, updated_at)
  values ('identifier:' || p_identifier_hash, v_now, 1, v_now)
  on conflict (rate_key) do update
    set window_started_at = case
          when private.neweix_login_rate_limits.window_started_at < v_now - interval '15 minutes' then v_now
          else private.neweix_login_rate_limits.window_started_at end,
        attempt_count = case
          when private.neweix_login_rate_limits.window_started_at < v_now - interval '15 minutes' then 1
          else private.neweix_login_rate_limits.attempt_count + 1 end,
        updated_at = v_now
  returning attempt_count into v_identifier_count;

  insert into private.neweix_login_rate_limits(rate_key, window_started_at, attempt_count, updated_at)
  values ('ip:' || p_ip_hash, v_now, 1, v_now)
  on conflict (rate_key) do update
    set window_started_at = case
          when private.neweix_login_rate_limits.window_started_at < v_now - interval '15 minutes' then v_now
          else private.neweix_login_rate_limits.window_started_at end,
        attempt_count = case
          when private.neweix_login_rate_limits.window_started_at < v_now - interval '15 minutes' then 1
          else private.neweix_login_rate_limits.attempt_count + 1 end,
        updated_at = v_now
  returning attempt_count into v_ip_count;

  delete from private.neweix_login_rate_limits
  where updated_at < v_now - interval '2 days';

  return v_identifier_count <= 5 and v_ip_count <= 20;
end;
$$;
revoke all on function public.neweix_consume_login_rate_limit(text, text) from public, anon, authenticated;
grant execute on function public.neweix_consume_login_rate_limit(text, text) to service_role;

comment on function public.neweix_consume_login_rate_limit(text, text) is
  'Private server-side username/email login throttling. Only the Supabase service role may execute it.';
