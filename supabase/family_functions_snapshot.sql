-- Database function definitions, no actual data or invite tokens.
CREATE OR REPLACE FUNCTION family_private.approve_family_request(p_request_id uuid, p_parent_id uuid, p_names text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n text; req public.family_requests%rowtype; begin
 if not family_private.is_admin() then raise exception 'not authorized' using errcode='42501'; end if;
 select * into req from public.family_requests where id=p_request_id for update;
 if not found or req.status <> 'pending' then raise exception 'request unavailable'; end if;
 if p_parent_id is not null and not exists(select 1 from public.family_people where id=p_parent_id and deleted_at is null) then raise exception 'parent not found'; end if;
 if coalesce(array_length(p_names,1),0)<1 or array_length(p_names,1)>50 then raise exception 'invalid names'; end if;
 foreach n in array p_names loop
  if length(trim(n))<1 or length(trim(n))>100 then raise exception 'invalid name'; end if;
  insert into public.family_people(name,parent_id) values(trim(n),p_parent_id);
 end loop;
 update public.family_requests set status='approved' where id=p_request_id;
end $function$
;

CREATE OR REPLACE FUNCTION family_private.get_auto_add()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin if not family_private.is_admin() then raise exception 'not authorized' using errcode='42501';end if;return (select auto_add from family_private.settings where id=true);end $function$
;

CREATE OR REPLACE FUNCTION family_private.has_invite()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1 from family_private.invitation i
    where (coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-tree-invite')
      in (i.token,i.short_code)
  )
$function$
;

CREATE OR REPLACE FUNCTION family_private.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select exists(select 1 from auth.users u where u.id = (select auth.uid()) and lower(u.email)='sloom05888@gmail.com' and u.email_confirmed_at is not null) $function$
;

CREATE OR REPLACE FUNCTION family_private.my_family_invite()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select short_code from family_private.invitation where family_private.is_admin()
$function$
;

CREATE OR REPLACE FUNCTION family_private.new_request_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.notification_read_at:=null;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION family_private.process_automatic_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare amount integer; distinct_amount integer; begin
 if not coalesce((select auto_add from family_private.settings where id=true),false) or new.selected_parent is null or new.proposed_names is null then return new;end if;
 if not exists(select 1 from public.family_people where id=new.selected_parent and deleted_at is null) then return new;end if; amount:=cardinality(new.proposed_names);
 if amount<1 or amount>50 or exists(select 1 from unnest(new.proposed_names) as n where n is null or length(btrim(n))<1 or length(btrim(n))>100) then return new;end if;
 select count(distinct lower(btrim(n))) into distinct_amount from unnest(new.proposed_names) as n;
 if distinct_amount<>amount then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.selected_parent::text, 0));
 if exists(select 1 from public.family_people p join unnest(new.proposed_names) as n on lower(btrim(p.name))=lower(btrim(n)) where p.parent_id=new.selected_parent and p.deleted_at is null) then return new;end if;
 insert into public.family_people(name,parent_id,gender) select btrim(n),new.selected_parent,'male' from unnest(new.proposed_names) as n;
 update public.family_requests set status='approved' where id=new.id;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION family_private.review_family_request(p_request_id uuid, p_parent_id uuid, p_names text[], p_context text, p_approve boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION family_private.rotate_invite_short_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.token is distinct from old.token then
    new.short_code:=translate(encode(extensions.gen_random_bytes(12),'base64'),'+/','-_');
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION family_private.set_auto_add(p_enabled boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin if not family_private.is_admin() then raise exception 'not authorized' using errcode='42501';end if;if p_enabled is null then raise exception 'invalid setting';end if;update family_private.settings set auto_add=p_enabled where id=true;return p_enabled;end $function$
;

CREATE OR REPLACE FUNCTION family_private.short_family_invite()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select short_code from family_private.invitation
  where family_private.is_admin() or family_private.has_invite()
$function$
;

CREATE OR REPLACE FUNCTION family_private.submit_request(p_sender text, p_phone text, p_parent uuid, p_context text, p_names text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare secret text; rid uuid; outdata jsonb;begin
if not family_private.has_invite() then raise exception 'invalid invitation' using errcode='42501';end if;
if cardinality(p_names) not between 1 and 50 or p_names is null or exists(select 1 from unnest(p_names) n where n is null or length(btrim(n)) not between 1 and 100) then raise exception 'invalid names';end if;
if p_parent is not null and not exists(select 1 from public.family_people where id=p_parent and deleted_at is null) then raise exception 'parent not found';end if;
secret:=encode(extensions.gen_random_bytes(32),'hex');
insert into public.family_requests(sender_name,phone,selected_parent,context,details,proposed_names,tracking_hash) values(p_sender,p_phone,p_parent,coalesce(p_context,''),array_to_string(p_names,E'\n'),p_names,extensions.digest(secret,'sha256')) returning id into rid;
select jsonb_build_object('token',secret,'status',r.status,'created_at',r.created_at,'names',r.proposed_names,'parent_name',p.name) into outdata from public.family_requests r left join public.family_people p on p.id=r.selected_parent where r.id=rid;return outdata;end $function$
;

CREATE OR REPLACE FUNCTION family_private.track_request(p_token text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select jsonb_build_object('status',r.status,'created_at',r.created_at,'names',r.proposed_names,'parent_name',p.name) from public.family_requests r left join public.family_people p on p.id=r.selected_parent where r.tracking_hash=extensions.digest(p_token,'sha256') $function$
;

CREATE OR REPLACE FUNCTION public.approve_family_request(p_request_id uuid, p_parent_id uuid, p_names text[])
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select family_private.approve_family_request(p_request_id,p_parent_id,p_names) $function$
;

CREATE OR REPLACE FUNCTION public.family_add_relative(p_person_id uuid, p_relation text, p_name text, p_gender text DEFAULT 'male'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare selected public.family_people%rowtype; new_id uuid; target_parent uuid;
begin
 if not family_private.is_admin() then raise exception 'not authorized' using errcode='42501'; end if;
 if length(trim(coalesce(p_name,'')))<1 or length(trim(p_name))>100 then raise exception 'invalid name'; end if;
 if p_gender not in ('male','unknown') then raise exception 'male only'; end if;
 select * into selected from public.family_people where id=p_person_id and deleted_at is null for update;
 if not found then raise exception 'person not found'; end if;
 if p_relation='child' then target_parent:=selected.id;
 elsif p_relation='sibling' then if selected.parent_id is null then raise exception 'add parent first'; end if; target_parent:=selected.parent_id;
 elsif p_relation='parent' then target_parent:=selected.parent_id;
 else raise exception 'invalid relation'; end if;
 insert into public.family_people(name,parent_id,gender) values(trim(p_name),target_parent,'male') returning id into new_id;
 if p_relation='parent' then update public.family_people set parent_id=new_id where id=selected.id; end if;
 return new_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.family_consume_bootstrap(p_token text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare ok boolean; begin update family_private.bootstrap set consumed_at=now() where id=true and consumed_at is null and expires_at>now() and token_hash=extensions.digest(p_token,'sha256') returning true into ok; return coalesce(ok,false); end $function$
;

CREATE OR REPLACE FUNCTION public.family_get_auto_add()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select family_private.get_auto_add() $function$
;

CREATE OR REPLACE FUNCTION public.family_manage_person(p_id uuid, p_action text, p_name text DEFAULT NULL::text, p_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare p public.family_people%rowtype; n integer; begin
if not family_private.is_admin() then raise exception 'not authorized' using errcode='42501';end if;
select * into p from public.family_people where id=p_id for update;if not found then raise exception 'person not found';end if;
if p_action='rename' then update public.family_people set name=btrim(p_name) where id=p_id;
elsif p_action='reorder' then
select count(*) into n from public.family_people where parent_id=p_id and deleted_at is null;
if coalesce(cardinality(p_ids),0)<>n or (select count(distinct v) from unnest(p_ids) v)<>n or exists(select 1 from unnest(p_ids) v where not exists(select 1 from public.family_people c where c.id=v and c.parent_id=p_id and c.deleted_at is null)) then raise exception 'invalid child order';end if;
update public.family_people c set sort_order=t.ord from unnest(p_ids) with ordinality t(id,ord) where c.id=t.id;
elsif p_action in ('delete','promote') then
if p_action='delete' and exists(select 1 from public.family_people where parent_id=p_id and deleted_at is null) then raise exception 'has children';end if;
if p_action='promote' then update public.family_people set parent_id=p.parent_id where parent_id=p_id and deleted_at is null;end if;
update public.family_people set deleted_at=now() where id=p_id;
elsif p_action='restore' then
if p.parent_id is not null and not exists(select 1 from public.family_people where id=p.parent_id and deleted_at is null) then raise exception 'restore parent first';end if;
update public.family_people set deleted_at=null where id=p_id;
else raise exception 'invalid action';end if;end $function$
;

CREATE OR REPLACE FUNCTION public.family_purge_trash(p_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_count integer; v_parent uuid;
begin
  if not family_private.is_admin() then
    raise exception 'not authorized' using errcode='42501';
  end if;
  -- Prevent concurrent edits from changing ancestry while clearing.
  lock table public.family_people in share row exclusive mode;
  if p_id is not null then
    select parent_id into v_parent from public.family_people
      where id=p_id and deleted_at is not null;
    if not found then raise exception 'deleted person not found'; end if;
    update public.family_people set parent_id=v_parent where parent_id=p_id;
    delete from public.family_people where id=p_id and deleted_at is not null;
  else
    -- Retained people should never be left pointing to a purged parent.
    with recursive ancestry as (
      select c.id as child_id, c.parent_id as ancestor_id, 1 as depth,
             array[c.id] as visited
      from public.family_people c
      join public.family_people p on p.id=c.parent_id
      where c.deleted_at is null and p.deleted_at is not null
      union all
      select a.child_id, p.parent_id, a.depth+1, a.visited || p.id
      from ancestry a join public.family_people p on p.id=a.ancestor_id
      where p.deleted_at is not null and a.depth < 500
        and not p.id=any(a.visited)
    ), resolved as (
      select distinct on (child_id) child_id, ancestor_id
      from ancestry a
      where ancestor_id is null or exists (
        select 1 from public.family_people p
        where p.id=a.ancestor_id and p.deleted_at is null)
      order by child_id,depth
    )
    update public.family_people c set parent_id=r.ancestor_id
    from resolved r where c.id=r.child_id;
    -- Deleted rows may reference one another; a single statement clears them together.
    delete from public.family_people where deleted_at is not null;
  end if;
  get diagnostics v_count = row_count;
  return v_count;
end $function$
;

CREATE OR REPLACE FUNCTION public.family_review_request(p_request_id uuid, p_parent_id uuid, p_names text[], p_context text, p_approve boolean)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select family_private.review_family_request(p_request_id,p_parent_id,p_names,p_context,p_approve)
$function$
;

CREATE OR REPLACE FUNCTION public.family_set_auto_add(p_enabled boolean)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select family_private.set_auto_add(p_enabled) $function$
;

CREATE OR REPLACE FUNCTION public.family_short_invite()
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select family_private.short_family_invite() $function$
;

CREATE OR REPLACE FUNCTION public.family_submit_request(p_sender text, p_phone text, p_parent uuid, p_context text, p_names text[])
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select family_private.submit_request(p_sender,p_phone,p_parent,p_context,p_names) $function$
;

CREATE OR REPLACE FUNCTION public.family_track_request(p_token text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select family_private.track_request(p_token) $function$
;

CREATE OR REPLACE FUNCTION public.my_family_invite()
 RETURNS text
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select family_private.my_family_invite() $function$
;