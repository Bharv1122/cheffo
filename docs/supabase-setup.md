# Supabase Setup for Cheffo Doggo

This guide configures:
- Email/password auth (login, signup, password reset)
- User-scoped dog profiles
- User-scoped saved recipes
- User preferences (active profile)

## 1) Create a Supabase project

1. Go to Supabase dashboard and create a new project.
2. In **Project Settings → API**, copy:
   - `Project URL`
   - `anon public key`
3. Create `.env` from `.env.example` and set:

```bash
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

## 2) Run SQL schema + RLS policies

Run the following in **SQL Editor**:

```sql
-- UUID support
create extension if not exists pgcrypto;

-- Dog profiles
create table if not exists public.dog_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  breed text not null,
  age_years integer not null,
  age_months integer not null default 0,
  weight_lbs numeric not null,
  ideal_weight_lbs numeric,
  life_stage text not null check (life_stage in ('puppy', 'adult', 'senior')),
  activity_level text not null check (activity_level in ('low', 'moderate', 'active', 'very_active')),
  meals_per_day integer not null default 2,
  allergies text[] not null default '{}',
  avoid_foods text[] not null default '{}',
  favorite_proteins text[] not null default '{}',
  picky_eater boolean not null default false,
  texture_preference text not null check (texture_preference in ('soft', 'chunky', 'brothy', 'dry_topper')),
  parent_skill_level text not null check (parent_skill_level in ('beginner', 'some_experience', 'very_comfortable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dog_profiles_user_id_idx on public.dog_profiles(user_id);

-- Saved recipes
create table if not exists public.saved_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_profile_id uuid not null references public.dog_profiles(id) on delete cascade,
  name text not null,
  description text not null,
  type text not null check (type in ('topper', 'full_meal', 'batch_week', 'pantry', 'treat')),
  recipe_data jsonb not null,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_recipes_user_id_idx on public.saved_recipes(user_id);
create index if not exists saved_recipes_dog_profile_id_idx on public.saved_recipes(dog_profile_id);

-- User preferences
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_profile_id uuid references public.dog_profiles(id) on delete set null,
  preferred_units text not null default 'imperial' check (preferred_units in ('imperial', 'metric')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Updated-at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Triggers
create trigger dog_profiles_set_updated_at
before update on public.dog_profiles
for each row execute function public.set_updated_at();

create trigger saved_recipes_set_updated_at
before update on public.saved_recipes
for each row execute function public.set_updated_at();

create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

-- RLS
alter table public.dog_profiles enable row level security;
alter table public.saved_recipes enable row level security;
alter table public.user_preferences enable row level security;

-- dog_profiles policies
create policy "dog_profiles_select_own" on public.dog_profiles
for select using (auth.uid() = user_id);

create policy "dog_profiles_insert_own" on public.dog_profiles
for insert with check (auth.uid() = user_id);

create policy "dog_profiles_update_own" on public.dog_profiles
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "dog_profiles_delete_own" on public.dog_profiles
for delete using (auth.uid() = user_id);

-- saved_recipes policies
create policy "saved_recipes_select_own" on public.saved_recipes
for select using (auth.uid() = user_id);

create policy "saved_recipes_insert_own" on public.saved_recipes
for insert with check (auth.uid() = user_id);

create policy "saved_recipes_update_own" on public.saved_recipes
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "saved_recipes_delete_own" on public.saved_recipes
for delete using (auth.uid() = user_id);

-- user_preferences policies
create policy "user_preferences_select_own" on public.user_preferences
for select using (auth.uid() = user_id);

create policy "user_preferences_insert_own" on public.user_preferences
for insert with check (auth.uid() = user_id);

create policy "user_preferences_update_own" on public.user_preferences
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "user_preferences_delete_own" on public.user_preferences
for delete using (auth.uid() = user_id);
```

## 3) Configure auth redirects

In **Authentication → URL Configuration**:
- Site URL: your app base URL (for local: `http://localhost:3000`)
- Redirect URLs include:
  - `http://localhost:3000/reset-password`
  - Your production domain reset route

## 4) Web behavior fallback

If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing, app falls back to localStorage mode.

## 5) Migrations

When adding new columns to existing tables, run the matching `ALTER TABLE` in **SQL Editor**.

### v1.1.x → v1.2 — `medications` column on `dog_profiles`

Adds a string array of current medications per dog so the safety validator can flag drug-food interactions during recipe generation.

```sql
ALTER TABLE public.dog_profiles
  ADD COLUMN IF NOT EXISTS medications text[] NOT NULL DEFAULT '{}';
```

Existing rows are backfilled with an empty array; client code defaults to `[]` for older localStorage-mode profiles. Safe to run multiple times.

## 6) React Native readiness notes

For React Native, reuse the same Supabase project and schema. Differences:
- Use Expo/React Native env strategy instead of `import.meta.env`
- Use `@react-native-async-storage/async-storage` for session persistence
- Use deep-link redirect URL for password reset/auth flows
- Keep RLS policies unchanged (they work cross-platform)
