-- Run after animations.sql. Same private files, wallet and jobs for both studios.
begin;
create or replace function public.animation_account_usage(p_user uuid,p_test boolean) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('consumed',coalesce(sum(credits) filter(where status='completed'),0),
 'reserved',coalesce(sum(credits) filter(where not settled),0),'completed',count(*) filter(where status='completed'))
 from public.animation_jobs where user_id=p_user and test=p_test
$$;
revoke all on function public.animation_account_usage(uuid,boolean) from public,anon,authenticated;
grant execute on function public.animation_account_usage(uuid,boolean) to service_role;
commit;
