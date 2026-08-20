create table if not exists public.funnel_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (event_name in (
    'preview_started',
    'signup_viewed',
    'signup_completed',
    'profile_completed',
    'recipe_generated',
    'return_visit'
  )),
  path text check (path is null or char_length(path) <= 120),
  source text check (source is null or char_length(source) <= 60),
  created_at timestamptz not null default now()
);

alter table public.funnel_events enable row level security;
revoke all on table public.funnel_events from anon, authenticated;
grant select, insert, update, delete on table public.funnel_events to service_role;

create index if not exists funnel_events_name_created_at_idx
  on public.funnel_events (event_name, created_at desc);
