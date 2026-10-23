-- Additive Studio layouts. Install after admin.sql. Never changes games or billing.
begin;
create table if not exists public.studio_layout_profiles(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 50),layout jsonb not null,
 revision integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.studio_layout_preferences(
 user_id uuid primary key references auth.users(id) on delete cascade,
 active_profile uuid references public.studio_layout_profiles(id) on delete set null);
create index if not exists studio_layout_user on public.studio_layout_profiles(user_id,created_at);
alter table public.studio_layout_profiles enable row level security;
alter table public.studio_layout_preferences enable row level security;
revoke all on public.studio_layout_profiles,public.studio_layout_preferences from public,anon,authenticated;
grant select on public.studio_layout_profiles,public.studio_layout_preferences to authenticated;
grant all on public.studio_layout_profiles,public.studio_layout_preferences to service_role;
drop policy if exists studio_layout_own on public.studio_layout_profiles;
create policy studio_layout_own on public.studio_layout_profiles for select to authenticated using(user_id=auth.uid());
drop policy if exists studio_layout_preference_own on public.studio_layout_preferences;
create policy studio_layout_preference_own on public.studio_layout_preferences for select to authenticated using(user_id=auth.uid());
create table if not exists public.studio_layout_default(
 singleton boolean primary key default true check(singleton),layout jsonb,revision integer not null default 0,
 updated_by uuid references auth.users(id) on delete set null,updated_at timestamptz not null default now());
insert into public.studio_layout_default(singleton) values(true) on conflict do nothing;
alter table public.studio_layout_default enable row level security;
revoke all on public.studio_layout_default from public,anon,authenticated;
grant all on public.studio_layout_default to service_role;

create or replace function public.studio_layout_user() returns uuid
language plpgsql stable security definer set search_path='' as $$declare u uuid:=auth.uid();begin
 if to_regprocedure('public.require_site_account()') is not null then perform public.require_site_account();end if;
 if u is null then raise exception 'LAYOUT_LOGIN_REQUIRED' using errcode='42501';end if;return u;
end $$;
create or replace function public.studio_layout_validate(p_layout jsonb) returns void
language plpgsql immutable set search_path='' as $$declare mode text;item jsonb;kind text;ids text[];ident text;begin
 if p_layout is null or octet_length(p_layout::text)>32768 or coalesce(p_layout->>'version','') not in ('1','2') or jsonb_typeof(p_layout->'custom') is distinct from 'boolean' then raise exception 'LAYOUT_INVALID';end if;
 foreach mode in array array['desktop','mobile'] loop
  if jsonb_typeof(p_layout->mode) is distinct from 'array' or jsonb_array_length(p_layout->mode)>64 then raise exception 'LAYOUT_INVALID';end if;ids:=array[]::text[];
  for item in select value from jsonb_array_elements(p_layout->mode) loop
   ident:=item->>'id';if ident is null or ident!~'^[a-z][a-z0-9-]{0,49}$' or ident=any(ids) or jsonb_typeof(item->'hidden') is distinct from 'boolean'
   or coalesce(item->>'x','')!~'^[0-9]+$' or coalesce(item->>'y','')!~'^[0-9]+$' or coalesce(item->>'w','')!~'^[0-9]+$' or coalesce(item->>'h','')!~'^[0-9]+$' then raise exception 'LAYOUT_INVALID';end if;
   if p_layout->>'version'='1' then
    if (item->>'x')::numeric not between 1 and 12 or (item->>'y')::numeric not between 1 and 3000 or (item->>'w')::numeric not between 2 and 12 or (item->>'h')::numeric not between 3 and 40 or (item->>'x')::numeric+(item->>'w')::numeric>13 then raise exception 'LAYOUT_INVALID';end if;
   else
    if (item->>'x')::numeric<0 or (item->>'y')::numeric not between 0 and 12000 or (item->>'w')::numeric not between (case when mode='mobile' then 120 else 160 end) and (case when mode='mobile' then 384 else 1280 end) or (item->>'h')::numeric not between 96 and 1800 or (item->>'x')::numeric+(item->>'w')::numeric>(case when mode='mobile' then 384 else 1280 end) then raise exception 'LAYOUT_INVALID';end if;
   end if;
   ids:=array_append(ids,ident);
  end loop;
 end loop;
 if jsonb_typeof(p_layout->'favorites') is distinct from 'object' then raise exception 'LAYOUT_INVALID';end if;
 foreach kind in array array['games','audio','animations'] loop
  if jsonb_typeof(p_layout#>array['favorites',kind]) is distinct from 'array' or jsonb_array_length(p_layout#>array['favorites',kind])>(case when kind='audio' then 12 else 40 end) then raise exception 'LAYOUT_INVALID';end if;
  for item in select value from jsonb_array_elements(p_layout#>array['favorites',kind]) loop
   if jsonb_typeof(item)<>'string' or (item#>>'{}')!~'^[A-Za-z0-9_.-]{1,100}$' then raise exception 'LAYOUT_INVALID';end if;
  end loop;
 end loop;
end $$;
create or replace function public.studio_layout_context() returns jsonb
language plpgsql stable security definer set search_path='' as $$declare u uuid:=public.studio_layout_user();r text;begin
 if to_regprocedure('public.site_admin_role()') is not null then execute 'select public.site_admin_role()' into r;end if;
 return jsonb_build_object('can_publish',coalesce(r in ('owner','admin'),false),'default',(select jsonb_build_object('layout',layout,'revision',revision) from public.studio_layout_default where singleton));
end $$;
create or replace function public.studio_layout_publish_default(p_layout jsonb,p_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$declare u uuid:=public.studio_layout_user();r text;d public.studio_layout_default;clean jsonb;mode text;begin
 if to_regprocedure('public.site_admin_role()') is not null then execute 'select public.site_admin_role()' into r;end if;
 if r is null or r not in ('owner','admin') then raise exception 'LAYOUT_ADMIN_REQUIRED' using errcode='42501';end if;
 if p_revision is null or p_revision<0 then raise exception 'LAYOUT_INVALID';end if;
 if p_layout is not null then
  perform public.studio_layout_validate(p_layout);
  if p_layout->>'version'<>'2' or p_layout->>'custom'<>'true' then raise exception 'LAYOUT_INVALID';end if;
  clean:='{"version":2,"custom":true,"favorites":{"games":[],"audio":[],"animations":[]}}'::jsonb;
  foreach mode in array array['desktop','mobile'] loop
   clean:=jsonb_set(clean,array[mode],(select coalesce(jsonb_agg(jsonb_build_object('id',value->'id','x',value->'x','y',value->'y','w',value->'w','h',value->'h','hidden',value->'hidden')),'[]'::jsonb) from jsonb_array_elements(p_layout->mode)));
  end loop;
 end if;
 select * into d from public.studio_layout_default where singleton for update;
 if d.revision<>p_revision then raise exception 'LAYOUT_CONFLICT';end if;
 update public.studio_layout_default set layout=clean,revision=revision+1,updated_by=u,updated_at=now() where singleton returning * into d;
 return jsonb_build_object('layout',d.layout,'revision',d.revision);
end $$;
create or replace function public.studio_layout_list() returns jsonb
language plpgsql stable security definer set search_path='' as $$declare u uuid:=public.studio_layout_user();begin
 return jsonb_build_object('profiles',coalesce((select jsonb_agg(to_jsonb(p)-'user_id' order by p.created_at) from public.studio_layout_profiles p where user_id=u),'[]'::jsonb),
 'active',(select active_profile from public.studio_layout_preferences where user_id=u));
end $$;
create or replace function public.studio_layout_save(p_id uuid,p_name text,p_layout jsonb,p_revision integer,p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$declare u uuid:=public.studio_layout_user();p public.studio_layout_profiles;begin
 if u is distinct from p_owner then raise exception 'LAYOUT_FORBIDDEN' using errcode='42501';end if;
 if p_id is null or p_name is null or length(trim(p_name)) not between 1 and 50 or p_revision is null or p_revision<0 then raise exception 'LAYOUT_INVALID';end if;
 perform public.studio_layout_validate(p_layout);
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,921));
 select * into p from public.studio_layout_profiles where id=p_id for update;
 if found then
  if p.user_id<>u then raise exception 'LAYOUT_FORBIDDEN' using errcode='42501';end if;
  if p.revision<>p_revision then raise exception 'LAYOUT_CONFLICT';end if;
  update public.studio_layout_profiles set name=trim(p_name),layout=p_layout,revision=revision+1,updated_at=now() where id=p_id returning * into p;
 else
  if p_revision<>0 then raise exception 'LAYOUT_CONFLICT';end if;
  if(select count(*) from public.studio_layout_profiles where user_id=u)>=8 then raise exception 'LAYOUT_LIMIT';end if;
  insert into public.studio_layout_profiles(id,user_id,name,layout) values(p_id,u,trim(p_name),p_layout) returning * into p;
 end if;
 insert into public.studio_layout_preferences(user_id,active_profile) values(u,p.id) on conflict(user_id) do update set active_profile=excluded.active_profile;
 return to_jsonb(p)-'user_id';
end $$;
create or replace function public.studio_layout_select(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$declare u uuid:=public.studio_layout_user();begin
 if not exists(select 1 from public.studio_layout_profiles where id=p_id and user_id=u) then raise exception 'LAYOUT_FORBIDDEN' using errcode='42501';end if;
 insert into public.studio_layout_preferences(user_id,active_profile) values(u,p_id) on conflict(user_id) do update set active_profile=excluded.active_profile;
end $$;
create or replace function public.studio_layout_delete(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$declare u uuid:=public.studio_layout_user();begin
 delete from public.studio_layout_profiles where id=p_id and user_id=u;if not found then raise exception 'LAYOUT_FORBIDDEN' using errcode='42501';end if;
end $$;
revoke all on function public.studio_layout_validate(jsonb),public.studio_layout_user(),public.studio_layout_list(),public.studio_layout_save(uuid,text,jsonb,integer,uuid),public.studio_layout_select(uuid),public.studio_layout_delete(uuid),public.studio_layout_context(),public.studio_layout_publish_default(jsonb,integer) from public,anon,authenticated;
grant execute on function public.studio_layout_context(),public.studio_layout_publish_default(jsonb,integer),public.studio_layout_list(),public.studio_layout_save(uuid,text,jsonb,integer,uuid),public.studio_layout_select(uuid),public.studio_layout_delete(uuid) to authenticated;
commit;
