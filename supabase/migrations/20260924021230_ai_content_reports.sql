-- Private developer review queue. Clients can only submit through the authenticated API.
create table public.ai_content_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid references public.saved_recipes(id) on delete set null,
  source text not null check (source in ('recipe', 'chat', 'image')),
  reason text not null check (reason in ('unsafe', 'offensive', 'incorrect', 'other')),
  details text not null default '' check (char_length(details) <= 500),
  content_title text not null check (char_length(content_title) <= 500),
  content_snapshot jsonb not null check (jsonb_typeof(content_snapshot) = 'object' and octet_length(content_snapshot::text) <= 1048576),
  status text not null default 'new' check (status in ('new', 'reviewed', 'resolved')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.ai_content_reports enable row level security;
revoke all on table public.ai_content_reports from public, anon, authenticated;
grant select, insert, update, delete on table public.ai_content_reports to service_role;
create index ai_content_reports_review_queue_idx on public.ai_content_reports(status, created_at);
create index ai_content_reports_user_id_idx on public.ai_content_reports(user_id);
create index ai_content_reports_recipe_id_idx on public.ai_content_reports(recipe_id);
comment on table public.ai_content_reports is 'Private in-app AI content reports. Chat snapshots are user submitted, not verified provider logs. Deleted with account; retained when a saved recipe is removed.';
