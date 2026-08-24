alter table public.subscriptions
  add column campaign_app text,
  add column campaign_code text,
  add column campaign_source text,
  add column campaign_trial_end timestamptz,
  add column campaign_redeemed_at timestamptz;

create table public.campaign_redemptions (
  id uuid primary key default gen_random_uuid(),
  app text not null,
  campaign_code text not null,
  user_id uuid not null,
  email_hash text not null,
  source text,
  redeemed_at timestamptz not null default now(),
  trial_end timestamptz not null,
  unique (app, campaign_code, user_id),
  unique (app, campaign_code, email_hash)
);

alter table public.campaign_redemptions enable row level security;
revoke all on public.campaign_redemptions from anon, authenticated;

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own
  on public.subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.subscriptions from anon, authenticated;

create or replace function public.redeem_3dayfree_campaign(
  p_user_id uuid,
  p_email_hash text,
  p_source text default null
)
returns table (trial_end timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trial_end timestamptz := now() + interval '3 days';
begin
  if exists (
    select 1 from public.subscriptions
    where user_id = p_user_id
      and stripe_subscription_id is not null
      and status in ('active', 'trialing', 'past_due')
  ) then
    raise exception 'already_premium';
  end if;

  insert into public.campaign_redemptions (
    app, campaign_code, user_id, email_hash, source, trial_end
  ) values (
    'cheffo-doggo', '3dayfree', p_user_id, p_email_hash,
    nullif(left(lower(trim(coalesce(p_source, ''))), 40), ''), v_trial_end
  );

  insert into public.subscriptions (
    user_id, status, campaign_app, campaign_code, campaign_source,
    campaign_trial_end, campaign_redeemed_at, trial_end,
    current_period_start, current_period_end
  ) values (
    p_user_id, 'trialing', 'cheffo-doggo', '3dayfree',
    nullif(left(lower(trim(coalesce(p_source, ''))), 40), ''),
    v_trial_end, now(), v_trial_end, now(), v_trial_end
  )
  on conflict (user_id) do update set
    status = 'trialing',
    campaign_app = excluded.campaign_app,
    campaign_code = excluded.campaign_code,
    campaign_source = excluded.campaign_source,
    campaign_trial_end = excluded.campaign_trial_end,
    campaign_redeemed_at = excluded.campaign_redeemed_at,
    trial_end = excluded.trial_end,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    updated_at = now();

  return query select v_trial_end;
exception
  when unique_violation then
    raise exception 'campaign_already_redeemed';
end;
$$;

revoke all on function public.redeem_3dayfree_campaign(uuid, text, text) from public, anon, authenticated;
grant execute on function public.redeem_3dayfree_campaign(uuid, text, text) to service_role;
