# Instructions for AI coding agents (Codex, Claude, others)

Cheffo Doggo is live: a React + Vite web app on Vercel, Supabase for auth and data, Stripe for web billing, and an Android app (`android-twa/`) that wraps the website. Several agents work on this repo. These rules keep them from breaking each other or production.

**Coordination channel:** GitHub issue #22 ("Coordination: Cheffo ChatGPT plugin integration"). Post plans that touch shared infrastructure there and wait for the owner's go-ahead before any live change.

## Never do these without the owner's explicit go-ahead in #22
- **Database:** never run `supabase db reset`, `supabase db push` of a full schema, a schema diff/sync, or re-apply existing migrations. `supabase/migrations/` does **not** describe the full live schema: core tables and functions predate it. An old migration (`20260824050333`) grants writes on `subscriptions`, and a later one revokes them, so replaying migrations could let any user make themselves Premium. Only add **new** migration files, dated after the latest one in the folder.
- **Existing tables:** don't change columns, RLS policies, or grants on `dog_profiles`, `saved_recipes`, `subscriptions`, `approvals`, `user_preferences`, `llm_usage`, or the content-report tables. Don't change the `saved_recipes.recipe_data` JSON shape (Cooking Mode, exports, and the voice assistant read `ingredients[]`, `instructions[]`, and `safetyNotes`).
- **Shared functions:** `check_and_increment_llm_usage` (daily AI limit) and `redeem_3dayfree_campaign`.
- **Auth:** Supabase JWT secret or API keys, Site URL, or existing redirect URLs. Don't set `app_metadata.cheffo_adult_confirmed`; only `/api/account/confirm-adult` sets it.
- **Billing:** never write to `subscriptions` (only the Stripe webhook does). Don't add plans or statuses, or change Stripe products, prices, or the webhook. Premium = status `active`/`trialing`/`past_due`, or an active `3dayfree` campaign. Keep `api/llm.ts` and the app in agreement.
- **Hosting:** the `vercel.json` security headers (CSP, `frame-ancestors 'none'`, `X-Frame-Options: DENY`), the SPA rewrite, and `public/.well-known/assetlinks.json` (the Android app link).
- **Env vars in use:** `OPENAI_API_KEY`, `GEMINI_API_KEY`, `LLM_*`, `VOICE_*`, `SUPABASE_*`, `STRIPE_*`. New features use their own prefix (e.g. `CHATGPT_PLUGIN_*`).
- **Android purchase rules:** `src/utils/distribution.ts`. The Android app shows no prices or purchase links (Google Play consumption-only policy). Every other feature must behave the same on web and Android.

## Safe patterns
- New tables get a feature prefix (e.g. `plugin_`) and RLS enabled. User foreign keys use `ON DELETE CASCADE`: `api/account/delete.ts` deletes `saved_recipes` before the auth user, so RESTRICT keys break account deletion.
- Read customer data as the user (their access token + RLS), not with the service-role key.
- Tell the owner in #22 about new tables that hold user data, so `api/account/export.ts` and the privacy policy stay complete.
- AI features: keys stay server-side. The bundle audit (`scripts/verify-audit-bundle.mjs`) fails the build if a key or provider endpoint reaches client assets.

## Before opening a PR
```bash
npm run lint
npm run build   # typecheck + Vite build + every verify:* script
```
Both must pass. Regenerate `package-lock.json` with npm; never hand-merge it. Open PRs as drafts, describe what you verified and what you could not, and link the PR in #22 if it touches anything above.
