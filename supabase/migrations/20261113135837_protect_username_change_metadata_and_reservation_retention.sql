-- Reservation records must survive deletion of the former Auth user.
begin;
alter table private.neweix_account_username_reservations
  drop constraint if exists neweix_account_username_reservations_former_user_id_fkey;
revoke update (username_changed_at) on table public.account from authenticated;
comment on table private.neweix_account_username_reservations is
  'Private 90-day reservation registry for usernames relinquished by Neweix Account users.';
commit;
