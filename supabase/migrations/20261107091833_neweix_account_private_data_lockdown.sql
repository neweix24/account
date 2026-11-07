alter table private.neweix_service_clients enable row level security;
alter table private.neweix_account_service_access enable row level security;
alter table private.neweix_account_security_events enable row level security;
alter table private.neweix_account_devices enable row level security;
revoke all on private.neweix_service_clients from anon, authenticated;
revoke all on private.neweix_account_service_access from anon, authenticated;
revoke all on private.neweix_account_security_events from anon, authenticated;
revoke all on private.neweix_account_devices from anon, authenticated;
