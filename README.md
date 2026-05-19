# Cheffo Doggo

Cheffo Doggo is a React + TypeScript + Vite app for creating homemade dog food recipes with profile-aware meal guidance.

## Features added in this update

- Supabase email/password auth (login, signup, reset password)
- Protected app routes with auth-aware redirects
- User-scoped cloud persistence for:
  - Dog profiles (`dog_profiles`)
  - Recipes (`saved_recipes`)
  - Preferences (`user_preferences`)
- Logout action in app shell
- Per-user assistant local chat history keying
- Automatic fallback to localStorage when Supabase env vars are missing

## Tech stack

- React 19
- TypeScript
- Vite
- React Router
- Supabase JS client
- Tailwind CSS 4

## Getting started

```bash
npm install
cp .env.example .env
# set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

## Environment variables

Required for cloud auth + sync:

```bash
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

If omitted, the app runs in localStorage mode.

## Supabase setup

Detailed schema + RLS + auth redirect setup:

- [`docs/supabase-setup.md`](./docs/supabase-setup.md)

## Scripts

```bash
npm run dev      # start dev server
npm run build    # typecheck + production build
npm run lint     # eslint
npm run preview  # preview production build
```

## Notes

- Build passes successfully (`npm run build`).
- Lint and typecheck both pass clean (`npm run lint`, `npm run build`).
