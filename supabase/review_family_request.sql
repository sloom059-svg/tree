-- Additive migration applied to the existing nryvvojfzablnfdqyzfy project.
-- No existing people, requests, accounts, policies or function signatures are replaced.
create or replace function family_private.review_family_request(
  p_request_id uuid, p_parent_id uuid, p_names text[], p_context text, p_approve boolean
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  current_request public.family_requests%rowtype;
  reviewed_names text[];
begin
  if not family_private.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select * into current_request from public.family_requests
    where id = p_request_id for update;
  if not found or current_request.status <> 'pending' then
    raise exception 'request unavailable';
  end if;
  if coalesce(cardinality(p_names),0) not between 1 and 50 or exists (
    select 1 from unnest(p_names) as item(name)
    where name is null or length(btrim(name)) not between 1 and 100
  ) then raise exception 'invalid names'; end if;
  if p_parent_id is not null and not exists (
    select 1 from public.family_people where id = p_parent_id and deleted_at is null
  ) then raise exception 'parent not found'; end if;
  if coalesce(p_approve,false) and p_parent_id is null then
    raise exception 'parent required';
  end if;
  if length(coalesce(p_context,'')) > 500 then raise exception 'context too long'; end if;
  select array_agg(btrim(name) order by ordinal) into reviewed_names
    from unnest(p_names) with ordinality as item(name,ordinal);
  update public.family_requests set
    selected_parent = p_parent_id,
    context = btrim(coalesce(p_context,'')),
    proposed_names = reviewed_names,
    details = array_to_string(reviewed_names,E'\n')
    where id = p_request_id;
  if coalesce(p_approve,false) then
    perform family_private.approve_family_request(p_request_id,p_parent_id,reviewed_names);
  end if;
  return jsonb_build_object('id',p_request_id,'status',case when coalesce(p_approve,false) then 'approved' else 'pending' end);
end;
$$;
revoke all on function family_private.review_family_request(uuid,uuid,text[],text,boolean) from public,anon;
grant execute on function family_private.review_family_request(uuid,uuid,text[],text,boolean) to authenticated;

create or replace function public.family_review_request(
  p_request_id uuid, p_parent_id uuid, p_names text[], p_context text, p_approve boolean
) returns jsonb
language sql security invoker set search_path = ''
as $$
  select family_private.review_family_request(p_request_id,p_parent_id,p_names,p_context,p_approve)
$$;
revoke all on function public.family_review_request(uuid,uuid,text[],text,boolean) from public,anon;
grant execute on function public.family_review_request(uuid,uuid,text[],text,boolean) to authenticated;
