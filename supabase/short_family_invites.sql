-- Short private invitation aliases; existing invitation tokens remain valid.
alter table family_private.invitation
  add column short_code text not null
  default translate(encode(extensions.gen_random_bytes(12),'base64'),'+/','-_');
alter table family_private.invitation
  add constraint family_invitation_short_code_unique unique(short_code),
  add constraint family_invitation_short_code_format check(short_code ~ '^[A-Za-z0-9_-]{16}$');

create or replace function family_private.has_invite() returns boolean
language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from family_private.invitation i
    where (coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-tree-invite')
      in (i.token,i.short_code)
  )
$$;

-- The administrator's existing RPC now returns the shorter, equivalent code.
create or replace function family_private.my_family_invite() returns text
language sql stable security definer set search_path=''
as $$
  select short_code from family_private.invitation where family_private.is_admin()
$$;

-- Already invited relatives may convert their old link when sharing it again.
-- Missing or invalid invitation headers never return a code.
create or replace function family_private.short_family_invite() returns text
language sql stable security definer set search_path=''
as $$
  select short_code from family_private.invitation
  where family_private.is_admin() or family_private.has_invite()
$$;
revoke all on function family_private.short_family_invite() from public;
grant execute on function family_private.short_family_invite() to anon,authenticated;

create or replace function public.family_short_invite() returns text
language sql stable security invoker set search_path=''
as $$ select family_private.short_family_invite() $$;
revoke all on function public.family_short_invite() from public;
grant execute on function public.family_short_invite() to anon,authenticated;

-- If an administrator ever rotates the original invitation, its short alias
-- rotates with it, so a revoked invitation cannot survive through its alias.
create or replace function family_private.rotate_invite_short_code() returns trigger
language plpgsql security invoker set search_path=''
as $$
begin
  if new.token is distinct from old.token then
    new.short_code:=translate(encode(extensions.gen_random_bytes(12),'base64'),'+/','-_');
  end if;
  return new;
end;
$$;
revoke all on function family_private.rotate_invite_short_code() from public,anon,authenticated;
create trigger rotate_family_invite_short_code before update of token
  on family_private.invitation for each row
  execute function family_private.rotate_invite_short_code();
