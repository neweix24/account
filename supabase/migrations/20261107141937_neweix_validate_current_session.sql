-- Validate a signed-in JWT against the live Supabase Auth session row.
-- Called by the Next.js proxy on every protected Account/MFA request.

create or replace function public.neweix_validate_current_session()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
  if v_user_id is null or v_session_id is null then
    return false;
  end if;

  return exists (
    select 1
    from auth.sessions s
    where s.id = v_session_id
      and s.user_id = v_user_id
      and (s.not_after is null or s.not_after > now())
  );
end;
$$;

revoke all on function public.neweix_validate_current_session() from public, anon;
grant execute on function public.neweix_validate_current_session() to authenticated;

comment on function public.neweix_validate_current_session() is
  'Returns true only when the caller JWT session_id still exists for auth.uid() and has not passed not_after. Used to fail closed on protected Neweix Account requests.';
