alter table public.subscriptions
  add column if not exists campaign_code text,
  add column if not exists campaign_trial_end timestamptz,
  add column if not exists campaign_redeemed_at timestamptz;

alter table public.subscriptions
  drop constraint if exists subscriptions_campaign_code_format,
  add constraint subscriptions_campaign_code_format
    check (campaign_code is null or campaign_code = lower(campaign_code));

comment on column public.subscriptions.campaign_code is
  'Server-verified no-card campaign attribution; never trusted from user metadata.';

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own
  on public.subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.subscriptions from anon, authenticated;

