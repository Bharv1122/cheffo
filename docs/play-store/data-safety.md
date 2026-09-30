# Google Play Data safety answers – Cheffo Doggo (current Android app)

Prepared 2026-09-30. Fill this in at **Play Console → Policy → App content → Data safety**.

**What this covers:** the Android app as it ships today. It is a Trusted Web Activity that opens `https://cheffodoggo.com/?distribution=google-play` (`android-twa/app/build.gradle` line 45). Everything the app collects is collected by the website running inside it, plus the providers the website uses (Supabase, Vercel, the AI provider, Resend). The Android wrapper only asks for `INTERNET` and `ACCESS_NETWORK_STATE` (`android-twa/app/src/main/AndroidManifest.xml`). It has no microphone, camera, location, contacts or notification permission, and it contains no ad or analytics SDK.

**Not covered (future features):** the realtime voice assistant (today only the owner-only `/voice-lab`, `docs/voice-lab.md`) and the ChatGPT plugin. See the section "When the voice assistant launches" at the end.

**Terms used below**

- **Collected** means data leaves the phone and goes to Cheffo Doggo or to a service working for Cheffo Doggo.
- **Shared** means passed to a *third party*. Play says transfers to **service providers** that process data on your behalf (Supabase, Vercel, Resend, the AI provider, Stripe) do **not** count as sharing. Verify the current definition in Play Console help ("Data sharing" exemptions).
- **Ephemeral** means processed only in memory to answer a request and not stored.

⚠️ OWNER items in this file need your decision. Anything marked "verify in Play Console help" is a point where I was not certain of Google's current rule.

---

## Part A – Overview questions

| Question | Answer | Evidence |
|---|---|---|
| Does your app collect or share any of the required user data types? | **Yes** | Account sign-up, dog profiles, analytics (below) |
| Is all of the user data collected by your app encrypted in transit? | **Yes** | HTTPS/TLS only. `vercel.json` sets HSTS. The TWA origin must be `https` (`android-twa/app/build.gradle` lines 5–7). Supabase and all APIs use `https://`. Privacy policy: "Encrypted in transit" (`src/pages/Legal/Privacy.tsx` line 139). |
| Which account creation methods does your app support? | **Username (email) and password** | `src/lib/auth.ts` `signUpWithEmailPassword` / `signInWithEmailPassword`. There is no Google/Apple/social sign-in. |
| Do you provide a way for users to request that their account and data be deleted? | **Yes** | In app: **Settings → Delete my account** (`src/pages/Settings/index.tsx` line 302, calls `api/account/delete.ts`) |
| Account-deletion web link (required) | `https://cheffodoggo.com/privacy#delete-account` | Public, no sign-in needed. Section "Delete your account" (`src/pages/Legal/Privacy.tsx` lines 157–184) gives the in-app steps **and** an email route (email `support@cheffodoggo.com` from the account email with subject "Cheffo Doggo account deletion"). The page scrolls to and focuses this section when opened with `#delete-account` (lines 9–29). |
| Can users request that some of their data be deleted without deleting their account? | **Yes** (optional question) | Users can delete individual dog profiles and saved recipes and clear chat conversations in the app. Other requests go through support email (Privacy.tsx lines 186–196). |
| Has your app been independently security-reviewed (MASA)? | **No** | |
| Is your app designed for children / in the Families program? | **No** | Adults only (see `content-rating-and-policies.md`) |

**Account-deletion URL check: ✅ it exists in code.** It is not a separate page but an anchored section of the public privacy policy, and Play accepts a link to the relevant section as long as it clearly explains how to request deletion (verify in Play Console help). ⚠️ OWNER: open `https://cheffodoggo.com/privacy#delete-account` on the live site while signed out and confirm that the section is there. The policy's effective date is September 23, 2026, so if the live site was deployed before that, the section may be missing.

**What deletion removes** (`api/account/delete.ts`): it first cancels any live Stripe subscription, then deletes the `approvals`, `saved_recipes`, `dog_profiles`, `user_preferences`, `llm_usage` and `subscriptions` rows, and finally the login (`auth.users`). Content reports (`ai_content_reports`) are removed through the database's cascade on the user foreign key (`CONTENT-REPORT-TRIAGE.md`), not by an explicit delete. Stripe's own payment records, security logs and anonymous analytics are kept (Privacy.tsx lines 147–155 and 177–183). The Data safety form lets you note that some data is retained for legal reasons. Keep that description consistent with the privacy policy.

---

## Part B – Data types

### Summary table (what to tick)

| Play category → data type | Collected? | Shared? | Ephemeral? | Required or optional | Purposes to tick |
|---|---|---|---|---|---|
| Personal info → **Email address** | **Yes** | No | No | Required | Account management, App functionality, Developer communications |
| Personal info → **User IDs** | **Yes** | No | No | Required | Account management, App functionality |
| Personal info → **Other info** (18+ confirmation) | **Yes** ⚠️ | No | No | Required | Account management, Fraud prevention/security/compliance |
| Personal info → Name, Address, Phone, Race/ethnicity, Political/religious beliefs, Sexual orientation | No | – | – | – | – |
| Financial info → **Purchase history** | **No** ⚠️ | – | – | – | – |
| Financial info → Payment info, Credit score, Other financial | No | – | – | – | – |
| Health and fitness → Health info, Fitness info | **No** ⚠️ | – | – | – | – |
| Messages → **Other in-app messages** (AI assistant chat) | **Yes** ⚠️ | No | No ⚠️ | Optional | App functionality, Personalization |
| Messages → Emails, SMS/MMS | No | – | – | – | – |
| Photos and videos → Photos, Videos | No | – | – | – | – |
| Audio → Voice or sound recordings, Music, Other audio | **No** (today) ⚠️ | – | – | – | – |
| Files and docs | No | – | – | – | – |
| Calendar, Contacts | No | – | – | – | – |
| Location → **Approximate location** | **Yes** ⚠️ (conservative) | No | No | Required | Analytics |
| Location → Precise location | No | – | – | – | – |
| App activity → **App interactions** | **Yes** | No | No | Required | Analytics |
| App activity → **Other user-generated content** | **Yes** | No | No | Required | App functionality, Personalization, Account management |
| App activity → In-app search history, Installed apps, Other actions | No | – | – | – | – |
| Web browsing → Web browsing history | No | – | – | – | – |
| App info and performance → **Diagnostics** | **Yes** | No | No | Required | Analytics |
| App info and performance → Crash logs, Other app performance data | No | – | – | – | – |
| Device or other IDs | **No** ⚠️ | – | – | – | – |

"Required" means a user cannot turn it off inside the app. Analytics and performance measurement run for every visitor (`src/main.tsx` lines 12–13), so they are marked Required.

### Details and evidence for each "Yes"

#### Email address – Collected, Required
- **What:** the user's sign-up email. The app also sends the **vet's email address** when a user asks their own vet to review a recipe (`api/approvals/request.ts` lines 97–100, emailed through Resend).
- **Why:** login, password reset, account emails, and the vet-approval email the user asked for.
- **Evidence:** `src/lib/auth.ts` (`supabase.auth.signUp({ email, password })`). Privacy.tsx line 52 ("Email address and a password") and line 117 (vet-approval and account emails through the email provider). Resend is listed as a service provider (line 130), so this is **not sharing**.
- The password is hashed by Supabase and is not a Play data type to declare separately. Verify in Play Console help.

#### User IDs – Collected, Required
- **What:** the Supabase account ID (UUID), which is attached to every stored row and to content reports.
- **Evidence:** `api/account/export.ts` (`user.id` in the export bundle). Privacy.tsx line 70 ("your account ID for private review"). Stripe customer and subscription IDs belong to web purchases, not the Android app (see Purchase history).

#### Other info (18+ self-confirmation) – Collected, Required ⚠️
- **What:** a yes/no flag saying the user confirmed they are at least 18, the time it was given, and the policy version. The app does **not** collect a birth date or ID.
- **Evidence:** sign-up checkbox (`src/pages/Auth/Signup.tsx` lines 14, 44–45, 152–153). Server write in `api/account/confirm-adult.ts` (`cheffo_adult_confirmed`, `cheffo_adult_confirmed_at`, `cheffo_adult_policy`). Privacy.tsx line 53.
- ⚠️ OWNER: This is conservative. A plain age-confirmation flag may not need declaring. Declaring it does no harm and matches the privacy policy.

#### Messages → Other in-app messages (AI assistant chat) – Collected, Optional ⚠️
- **What:** the questions a user types to "Ask Cheffo Doggo", along with the dog profile attached to the conversation. They are sent through `/api/llm` to the AI provider to produce a reply. Chat history is kept **on the phone** (browser storage), not in Cheffo's database. If the user reports a reply, that reply's text is stored as a content report.
- **Why optional:** only people who choose to use the assistant (a Premium feature) send chat messages.
- **Evidence:** `src/utils/assistantChat.ts` (calls `/api/llm`). `api/llm.ts` forwards to the provider at `LLM_BASE_URL` (lines 119–120, 210–217). Privacy.tsx lines 65–66 ("Conversations with the in-app AI assistant … saved locally"), line 112 and line 131 (AI providers as service providers). Report path: `src/utils/contentReports.ts`.
- **Ephemeral?** Cheffo's own server does not store chat content (`api/llm.ts` logs only error stages and statuses). The **AI provider's retention, however, is "governed by the terms applicable to the configured service"** (Privacy.tsx line 131). ⚠️ OWNER: Answer "processed ephemerally = Yes" only if your AI provider account has zero data retention. Otherwise answer **No**. Also check with the provider whether it uses your API data for training.
- ⚠️ OWNER: Some developers record AI chat under *App activity → Other user-generated content* instead of *Messages*. Play describes "Other in-app messages" as covering "chat content" (verify in Play Console help). Declaring it under Messages is the more transparent choice. If you declare it there, you do **not** also need to list it under user-generated content.

#### Approximate location – Collected, Required, Analytics ⚠️ (conservative)
- **What:** Vercel Web Analytics and Speed Insights work out the country, region or city from the visitor's IP address. The app never asks for GPS or the Android location permission.
- **Evidence:** Privacy.tsx lines 92–97 ("approximate country, region, or city information"). `src/main.tsx` lines 3–4 and 12–13. Vercel is a service provider (line 127), so this is **not sharing**.
- ⚠️ OWNER: Play defines approximate location as roughly city-level or coarser. Because Vercel records city, declaring it is the safer answer. Verify in Play Console help whether IP-derived location counts when the developer never sees it per user.

#### App interactions – Collected, Required, Analytics
- **What:** page views (Vercel Web Analytics) and a small set of product steps (`preview_started`, `signup_viewed`, `signup_completed`, `profile_completed`, `recipe_generated`, `return_visit`). These steps are stored **without** a user ID, email, dog details or IP address.
- **Evidence:** `api/analytics/event.ts` lines 5–8 (allowed events) and the insert, which stores only `event_name`, `path` and `source`. `src/main.tsx` lines 12–13 (Vercel analytics with a redaction hook, `redactTelemetryEvent`). Privacy.tsx lines 92–99 and 227–230.

#### Other user-generated content – Collected, Required
- **What:** dog profiles (name, breed, age, weight, life stage, activity, allergies, medications, foods to avoid, preferences), saved recipes and generated recipe images, settings, pantry ingredient lists, vet-approval requests and outcomes, and content reports (reason plus optional note). Recipe titles and ingredients are also sent to the AI provider to create recipe artwork.
- **Why required:** personalized recipes need a dog profile (Help: "Do I need to add a dog profile? Yes").
- **Evidence:** Privacy.tsx lines 56–77. `api/account/export.ts` (tables `dog_profiles`, `saved_recipes`, `user_preferences`, `approvals`, `ai_content_reports`). `src/utils/recipeImageGenerator.ts` line 10 (`/api/llm?type=image`).
- **Is the dog data "Health info"? Recommendation: No.** Play's Health info type covers the *user's* health (medical records, symptoms and so on). Allergies and medications here belong to the user's **dog**, not to a person. They are declared here as user-generated content, so they are still disclosed. ⚠️ OWNER: This is a judgement call. If a reviewer pushes back, adding "Health info" is harmless. Verify in Play Console help.

#### Diagnostics – Collected, Required, Analytics
- **What:** Vercel Speed Insights measures page loading performance along with page URL, browser/device details and country.
- **Evidence:** `src/main.tsx` line 13. Privacy.tsx lines 95–98.

### Details for important "No" answers

| Data type | Why "No" | Evidence |
|---|---|---|
| Purchase history / payment info ⚠️ | The Android app sells nothing and sends no payment data. Checkout and the billing portal are blocked in the Android build (`src/utils/distribution.ts` `requireWebBilling`, `src/pages/Pricing/index.tsx` line 94). The server keeps subscription status from **web** Stripe purchases, and the app only *reads* it to unlock access. | ⚠️ OWNER: Play's definition covers data "collected by your app". Reading an entitlement is not collection, so "No" is defensible. If you want to be extra cautious, declare *Purchase history → Collected, Account management*. Verify in Play Console help. |
| Photos and videos | There is no photo upload anywhere. Recipe images are generated by the app, not taken from the user. Content reports accept no uploaded photos (`CONTENT-REPORT-TRIAGE.md`: "No arbitrary photo upload is accepted"). | No `type="file"` or camera capture in `src/` |
| Audio (today) ⚠️ | Cooking Mode's optional voice controls use the **browser's built-in speech recognition** (`src/hooks/useVoice.ts`, `SpeechRecognition` / `speechSynthesis`). Cheffo's code never receives audio, only the recognized command text, which is used in the moment and not stored. The Android wrapper has no `RECORD_AUDIO` permission, and Chrome asks for the microphone itself. | Privacy.tsx lines 79–83 and 132. ⚠️ OWNER: Chrome (Google's speech service) may process the audio, but that is the browser acting for the user, not Cheffo. Verify in Play Console help whether browser-handled speech in a TWA must be declared. If unsure, declaring *Audio → Voice or sound recordings: Collected, ephemeral, optional, App functionality* is the cautious choice. |
| Device or other IDs ⚠️ | No advertising ID, Android ID or persistent device ID. Vercel Analytics uses a temporary visitor hash that expires after 24 hours. Rate limiting uses a **hashed** IP address (`api/_lib/rateLimit.ts` lines 28–38). | Privacy.tsx lines 91–94. ⚠️ OWNER: verify in Play Console help whether a daily-rotating hash counts. |
| Web browsing history | Analytics only covers pages on cheffodoggo.com itself, which is already declared as App interactions. | |
| Crash logs | No crash-reporting SDK (dependencies in `package.json`: supabase-js, @vercel/analytics, @vercel/speed-insights, @google/genai, react, recharts, lucide-react). | |
| Name / phone / address | Not requested from the user. (The **vet** types their own name and practice into the web approval form, but the vet is not an app user.) | `api/approvals/submit.ts` |

### Sharing: why every answer is "Not shared"
All recipients are service providers working for Cheffo Doggo: Supabase (database and login), Vercel (hosting, analytics), Resend (email), the AI provider (chat and images) and Stripe (web billing only). Unsplash serves fallback photos directly to the browser (Privacy.tsx lines 101–104 and 129) and receives only standard request data such as the IP address, which Play generally treats as not a declarable "share" (verify in Play Console help). The policy says "We do not sell your data. We do not share data with advertisers" (line 134).

### Security section
| Question | Answer |
|---|---|
| Data encrypted in transit | Yes |
| Users can request data deletion | Yes (in-app Settings → Delete my account; web: `https://cheffodoggo.com/privacy#delete-account`; email `support@cheffodoggo.com`) |
| Committed to Play Families Policy | No (not a children's app) |
| Independent security review | No |

---

## When the voice assistant launches (future – do NOT declare now)

The owner-only Voice Lab (`/voice-lab`, `docs/voice-lab.md`) streams microphone audio to an AI voice provider (Gemini Live or OpenAI Realtime). It is blocked for customers today because the server only issues sessions to `VOICE_LAB_ALLOWED_EMAILS`. When a voice assistant ships to customers, **update this form in the same release**:

| Play data type | Collected | Shared | Ephemeral | Required/optional | Purpose |
|---|---|---|---|---|---|
| Audio → **Voice or sound recordings** | Yes | No (the AI voice provider is a service provider) | Yes, *if* the provider does not keep the audio (confirm with the provider) | Optional | App functionality |
| Messages → Other in-app messages (voice transcripts, if kept or sent) | Yes | No | Yes/No depending on storage | Optional | App functionality |

The privacy policy must also be updated first. Today it says audio is handled only by "your browser or device's speech service" (Privacy.tsx line 132). The planned combined privacy update for voice and the ChatGPT plugin is **not** needed for the first Android release as long as neither feature is live.
