create function public.redeem_steph_lifetime(p_user_id uuid, p_email_hash text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(731104, 1);
  if exists (select 1 from public.campaign_redemptions where app='cheffo-doggo' and campaign_code='steph') then
    raise exception 'code_already_used';
  end if;
  perform 1 from public.subscriptions where user_id=p_user_id for update;
  if exists (select 1 from public.subscriptions where user_id=p_user_id and
    (stripe_subscription_id is not null or (status='active' and campaign_code is null))) then
    raise exception 'already_premium';
  end if;
  insert into public.campaign_redemptions(app,campaign_code,user_id,email_hash,trial_end)
    values ('cheffo-doggo','steph',p_user_id,p_email_hash,'infinity');
  insert into public.subscriptions(user_id,status,current_period_start,current_period_end)
    values(p_user_id,'active',now(),null)
  on conflict(user_id) do update set
    status='active', current_period_start=now(), current_period_end=null,
    trial_end=null, cancel_at_period_end=false, canceled_at=null,
    campaign_app=null, campaign_code=null, campaign_source=null,
    campaign_trial_end=null, campaign_redeemed_at=null, updated_at=now();
  return true;
end;
$$;
revoke all on function public.redeem_steph_lifetime(uuid,text) from public,anon,authenticated;
grant execute on function public.redeem_steph_lifetime(uuid,text) to service_role;
