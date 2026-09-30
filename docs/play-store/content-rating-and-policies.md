# Content rating, audience and policy declarations – Cheffo Doggo

Prepared 2026-09-30. These forms are under **Play Console → Policy → App content**. The exact wording of Google's questions changes over time, so match each answer below to the closest question on screen. Anything marked "verify in Play Console help" is a point where I was not certain of Google's current rule.

---

## 1. Content rating (IARC questionnaire)

**Email for the rating certificate:** `support@cheffodoggo.com`

**Category:** choose the non-game category that best fits a reference or utility app. Recent versions of the form have offered options like "Reference, News, or Educational" and "All Other App Types". **Do not** pick "Social" or "Game". Pick whichever of these appears on screen, and verify in Play Console help.

| Question topic | Answer | Reasoning / evidence |
|---|---|---|
| Violence (realistic, fantasy, blood, gore) | **No** | Cooking app. Nothing violent. |
| Fear / horror | **No** | |
| Sexual content or nudity | **No** | |
| Crude humor | **No** | |
| Profanity / crude language | **No** | App copy has none. AI replies are limited to dog-food topics (see section 8). |
| Controlled substances (drugs, **alcohol**, tobacco) | **No** | Alcohol and caffeine appear only as **ingredients to block** because they are toxic to dogs (Help → "What ingredients are off-limits?", `src/pages/Help/index.tsx`). That is a safety warning, not a depiction or encouragement of use. If the form asks specifically about *references* to alcohol, answer based on its wording. A warning list is generally not considered a "reference to use" (verify in Play Console help). |
| Gambling / simulated gambling | **No** | |
| Discrimination / hate | **No** | |
| Does the app let users interact or exchange content with **other users**? | **No** | There are no user-to-user features: no profiles visible to others, no comments, no messaging. The vet-approval email goes to the user's own vet, who opens a one-time review form and is not an app user (`api/approvals/request.ts`). Content reports go privately to the developer. |
| Does the app share the user's location with other users? | **No** | |
| Does the app allow users to buy **digital goods**? | **No** | The Android build blocks checkout and the billing portal (`src/utils/distribution.ts` `requireWebBilling`; `src/pages/Pricing/index.tsx` line 94 shows only an "account access" message). |
| Does the app contain an unrestricted web browser / can users browse the open web? | **No** | The TWA only opens `cheffodoggo.com`. The launcher "rejects external origins" (`android-twa/README.md`, "Current distribution decision"). External links (such as Instacart ingredient searches in `src/utils/affiliate.ts`) open outside the app. |
| Does the app contain **AI-generated content** / a generative-AI feature? (newer forms may ask) | **Yes** | AI chat assistant and AI recipe artwork. See section 8. |

**Expected result:** the lowest rating band (for example "Everyone" / PEGI 3 / USK 0). This is only an estimate. IARC decides the rating from your answers.

**Note:** the content rating describes *what is in the app*. It is separate from *who the app is for*. The app can be rated "Everyone" and still be offered only to adults (section 2).

---

## 2. Target audience and content

| Question | Recommended answer | Evidence |
|---|---|---|
| Target age groups | **18 and over only.** Do not tick any younger group. | Terms: "You must be at least 18 years old to create an account or use the Service" (`src/pages/Legal/Terms.tsx` line 44). Privacy: "intended only for adults aged 18 and older" (`src/pages/Legal/Privacy.tsx` lines 205–210). |
| Could your store listing unintentionally appeal to children? | **No** | The listing uses a friendly dog mascot, but its content (cooking, portions, vet packets) is aimed at adult dog owners. ⚠️ OWNER: keep the feature graphic and screenshots free of cartoon-style child-appeal imagery. |
| Families program / Designed for Families | **Do not opt in** | |

**How 18+ is enforced in the app today (so you can describe it accurately):**

1. **At sign-up:** a required checkbox "I confirm that I am at least 18 years old." (`src/pages/Auth/Signup.tsx` lines 44–45, 152–153).
2. **Before any AI feature:** the app checks the server-set flag `app_metadata.cheffo_adult_confirmed`. If the flag is missing (for example on older accounts), a confirmation dialog appears (`src/lib/adultConfirmation.ts` lines 26–45, `src/components/auth/AdultConfirmationGate.tsx`). Only the server endpoint `api/account/confirm-adult.ts` can set the flag.
3. **On the server:** `api/llm.ts` line 105 refuses AI requests unless the flag is true.

This is **self-attestation, not age verification.** The code and the Terms both say so (`api/account/confirm-adult.ts` comment; Terms line 44). Do not describe it to Google as "age verification".

---

## 3. Ads declaration

**Answer: "No, my app does not contain ads."**

Evidence:
- There is no ad SDK in the web app (`package.json` dependencies: `@supabase/supabase-js`, `@vercel/analytics`, `@vercel/speed-insights`, `@google/genai`, `react`, `react-dom`, `react-router-dom`, `recharts`, `lucide-react`) and none in the Android wrapper (`android-twa/app/build.gradle`: only `androidbrowserhelper`).
- Privacy policy: "We don't sell data, don't run ads" (Privacy.tsx line 37) and "We do not run advertising trackers" (line 98).
- Instacart links are plain ingredient searches with **no commission** today (`src/utils/affiliate.ts` header comment: "Until then this is a plain Instacart search — same UX, no commission").

⚠️ OWNER: If the Instacart/CJ affiliate deal (the TODO in `src/utils/affiliate.ts`) goes live, check in Play Console help whether affiliate links change this answer or the Data safety form.

---

## 4. App access (instructions for Google's reviewers)

Almost everything in the app sits behind a sign-in, and most features need Premium access. Google's reviewers therefore need a **working demo account that already has Premium**, because they cannot buy it in the Android app.

⚠️ OWNER: Create a dedicated reviewer account (not your personal one) and give it Premium through a normal, supported route, **not** by editing the database. `AGENTS.md` forbids writing to `subscriptions` except through the Stripe webhook. Options:
- (a) buy Premium for that account on the **website** with a real card or a Stripe coupon, or
- (b) any owner-approved complimentary-access method you already use.

The `3dayfree` campaign code lasts only 3 days, and Play review can take longer, so do not rely on it. When signing up, tick the 18+ box. Before submitting, add a sample dog profile and one saved recipe so the reviewer sees real content right away.

**Paste into Play Console → App content → App access → "All or some functionality is restricted" → Add instructions:**

```text
Name: Cheffo Doggo reviewer account
Username / email: ⚠️ OWNER: reviewer email here
Password: ⚠️ OWNER: reviewer password here

Instructions:
1. Open the app. On the welcome screen, tap "Sign in" (top right) and sign in with the account above. No two-factor code or email link is needed.
2. The account already has a sample dog ("Molly") and a saved recipe, and it includes Premium access, so every feature is unlocked.
3. Things to try:
   - Profiles: open the dog profile to see weight, life stage, allergies and foods to avoid.
   - Bowl Builder: pick a recipe type (full meal, weekly batch, topper or treat) and tap "Generate Recipe".
   - Recipes: open a saved recipe to see ingredients, portions and the shopping list. Tap "Cook" to open step-by-step Cooking Mode with a timer.
   - Calculator: estimate daily calories and portions.
   - Ask Cheffo Doggo (chat bubble / Assistant tab): ask a question such as "Can I add eggs to recipes?".
   - Reporting AI content: every assistant reply has a "Report reply" link, and each saved recipe has "Report recipe" and "Report image" buttons. Reports go privately to the developer.
   - Vet export: from a recipe, open the vet packet to print or share with your own veterinarian.
   - Settings: "Download my data" and "Delete my account" (please do NOT delete this reviewer account).
4. Purchases: this Android app does not sell anything. It has no prices, checkout or payment screens. Existing subscribers keep the access already on their account. Screens that mention Premium show only an account-access notice.
5. AI features require the user to confirm they are 18 or older. This account has already confirmed.
6. Voice controls in Cooking Mode are optional. They use the device browser's speech feature and appear only if the device supports it.

Support: support@cheffodoggo.com
```

⚠️ OWNER: Keep the reviewer account's password unchanged and its Premium active for as long as the app is on Play. Google re-reviews updates and fails the review if the account stops working. Also confirm that the "Sign in" link and the chat bubble / Assistant tab names in step 3 match what the live app shows, since I wrote them from the code, not from a device.

---

## 5. Health apps declaration

Play Console now asks developers to complete a **Health apps** declaration, listing any health features (medical, fitness, nutrition and so on). Verify the exact form in Play Console help.

**Recommendation: declare that the app has no human health features.**

- Play's health policies are about **human** health and health data. Cheffo Doggo's nutrition guidance, calorie estimates, allergy checks and medication-interaction notes are all about the **dog**.
- The app does not collect any data about the user's own health, and it does not claim to diagnose or treat anything. Terms: "The Service does not diagnose, treat, cure, or prevent any condition in your dog" (Terms line 38), and it "is not a substitute for veterinary care" (lines 30–36).
- ⚠️ OWNER: If the form offers a "nutrition / diet" option, do **not** tick it, because it refers to people. If a reviewer disagrees, the fallback is to describe the app as "pet food recipes and educational guidance, no human health data". Keep the store listing free of medical claims (see `store-listing.md`) so this position holds up.

Health Connect: **not used** (no Android health permissions in `AndroidManifest.xml`).

---

## 6. Other App content declarations

| Declaration | Answer | Reason |
|---|---|---|
| Financial features | **"My app doesn't provide any financial features"** | No banking, loans, crypto or payments. Web subscriptions are billing for the app itself, not a financial feature. |
| Government app | **No** | |
| News app | **No** | The static "Learn" articles (`public/learn/`) are evergreen educational guides, not news. |
| COVID-19 contact tracing / status | **No** (if asked) | |
| Data safety | See `data-safety.md` | |
| Privacy policy | `https://cheffodoggo.com/privacy` | |
| Advertising ID (Android 13+ question) | **No, the app does not use the advertising ID** | The wrapper declares no `AD_ID` permission (`AndroidManifest.xml`), and there is no ads SDK. Verify in Play Console help whether Android Browser Helper adds it. It should not. |

---

## 7. Payments policy note (consumption-only)

- The Android build hides checkout, the billing portal and prices through `isGooglePlayApp()` (`src/utils/distribution.ts`). The marker never grants access; the server still checks Premium status.
- Google's payments FAQ allows "consumption-only" apps that let users use content bought elsewhere, provided the app has no purchase flow and no links or calls to action to buy outside the app (`android-twa/README.md` cites support.google.com/googleplay/android-developer/answer/10281818). Verify the exact current wording there.
- **Several upgrade prompts still appear in the Android build.** They are listed in `launch-checklist.md`, section "Engineering", and should be fixed before submitting.

---

## 8. AI-generated content policy

Play's **AI-Generated Content** policy (cited in `CONTENT-REPORT-TRIAGE.md`: support.google.com/googleplay/android-developer/answer/13985936) expects apps with generative AI to prevent offensive or harmful output and to let users **report offensive AI content from inside the app, without leaving it**.

**What Cheffo Doggo generates with AI**
- Chat replies from "Ask Cheffo Doggo" (`src/utils/assistantChat.ts` → `api/llm.ts`).
- Recipe artwork (`src/utils/recipeImageGenerator.ts`, `/api/llm?type=image`).
- Recipes created from chat (`src/utils/chatRecipeConverter.ts`). Standard Bowl Builder recipe text is built from templates on the device, not by AI (`src/utils/guestTreat.ts` header comment).

**In-app reporting (meets the "report without leaving the app" requirement)**
| Where | Button | Code |
|---|---|---|
| Assistant page, on each AI reply | "Report reply" | `src/pages/Assistant/index.tsx` line 305 |
| Floating chat bubble, on each AI reply | "Report reply" | `src/components/chat/FloatingChatHead.tsx` line 235 |
| Saved recipe page | "Report recipe" | `src/pages/Recipes/RecipeDetail.tsx` line 702 |
| Saved recipe page, when it has an image | "Report image" | `src/pages/Recipes/RecipeDetail.tsx` line 703 |

Reports are saved privately to `ai_content_reports` through `POST /api/content-reports` (`src/utils/contentReports.ts`), with reasons "unsafe / offensive / incorrect / other". The owner reviews them by the process in `CONTENT-REPORT-TRIAGE.md`.

**Safeguards to mention if asked**
- AI features are adults-only (18+ confirmation, section 2) and Premium-only, and each account has a daily limit (`check_and_increment_llm_usage`, `api/llm.ts` lines 190–206).
- Recipes are checked against a blocked-ingredient list and the dog's allergies and foods to avoid (`src/utils/safetyValidator.ts`; Help → "What ingredients are off-limits?").
- Terms warn that AI output "may contain errors" and is "a starting point, not authoritative advice" (Terms lines 93–100).

⚠️ OWNER: `CONTENT-REPORT-TRIAGE.md` says reports are reviewed by hand and there is no email alert. Commit to checking the report queue regularly (for example weekly, and before each release). Google may ask how reports are handled.
