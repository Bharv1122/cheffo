alter table public.subscriptions
  drop column if exists campaign_code,
  drop column if exists campaign_trial_end,
  drop column if exists campaign_redeemed_at;

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own
  on public.subscriptions
  for select
  to public
  using (auth.uid() = user_id);

grant insert, update, delete on public.subscriptions to anon, authenticated;

