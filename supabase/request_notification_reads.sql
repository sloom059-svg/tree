-- Notification reading is independent of request review/approval.
alter table public.family_requests add column notification_read_at timestamptz;

-- Older completed requests are history, rather than new arrival notifications.
update public.family_requests set notification_read_at=created_at
  where status in ('approved','rejected');

-- An invited sender cannot hide a new notification by supplying a read date.
create function family_private.new_request_notification() returns trigger
language plpgsql security invoker set search_path=''
as $$
begin
  new.notification_read_at:=null;
  return new;
end;
$$;
revoke all on function family_private.new_request_notification() from public,anon,authenticated;
create trigger new_family_request_notification before insert on public.family_requests
  for each row execute function family_private.new_request_notification();
