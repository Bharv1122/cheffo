# Google Play launch checklist – Cheffo Doggo

Prepared 2026-09-30. Work through the steps **in order**, top to bottom. Some steps in one section wait for a step in another, and this is noted where it applies. Related files: `store-listing.md`, `data-safety.md`, `content-rating-and-policies.md`.

**Where things stand today (from the repo)**

| Item | Current value | Source |
|---|---|---|
| Package name | `com.cheffodoggo.app` (a draft Play app exists, nothing uploaded yet) | `android-twa/production/README.md` |
| Next upload | **versionCode `2`**, versionName `0.1.0`, targetSdk 36, minSdk 26 | `android-twa/production/gradle.properties` (`CHEFFO_VERSION_CODE=2`), `android-twa/app/build.gradle` lines 38–42 |
| Upload key certificate SHA-256 | `9E:41:E3:EE:83:E7:94:9F:57:68:F4:56:BF:CC:76:14:F0:4C:0C:41:97:00:71:90:8C:0A:06:7E:D0:8A:62:A2` | `android-twa/production/README.md` |
| Play app-signing certificate | **Not set up yet**, according to the production README (2026-09-23) | same |
| `public/.well-known/assetlinks.json` (exact content) | One entry: `package_name` `com.cheffodoggo.app`, **one** fingerprint `A8:25:8E:EC:06:2B:E4:5D:54:18:15:AA:23:D5:4E:EE:B9:15:CD:FD:A7:D8:8A:8C:0D:78:09:C6:D0:06:78:C6` | the file itself |

⚠️ **The assetlinks fingerprint (`A8:25…78:C6`) is not the upload certificate (`9E:41…62:A2`), and no document in the repo says where it came from.** It may already be the Play app-signing certificate, or it may be left over from something else. Step O3 below settles this. Until it matches the Play app-signing certificate, the Play-installed app will open with a **browser address bar** instead of full screen (`android-twa/README.md`, release gate 4).

---

## A. Owner does in Play Console

| # | Step | Details | Done |
|---|---|---|---|
| O1 | **Check the draft app** | Play Console → your app. Confirm the package is `com.cheffodoggo.app` and that **no** build has been uploaded yet. If one has, tell engineering the highest versionCode used, because the next upload must be higher. | ☐ |
| O2 | **Turn on Play App Signing** | Test and release → Setup → **App integrity → App signing**. Choose "Let Google manage and protect your app signing key" (the recommended default). Keep the existing upload key in `%LOCALAPPDATA%\CheffoDoggo\Signing` and **do not create a new one** (`android-twa/production/README.md`). | ☐ |
| O3 | **Copy the Play app-signing SHA-256** | Same page → "App signing key certificate" → **SHA-256 certificate fingerprint**. Send it to engineering (it is public, so it is safe to share). Compare it with `A8:25:8E:EC:…:78:C6` in `assetlinks.json`: **if it matches**, nothing changes. **If it differs**, go to E1. | ☐ |
| O4 | **Upload the first build to Internal testing** | Test and release → Testing → **Internal testing** → Create release → upload `app-release.aab` (versionCode 2) built on your Windows PC (step X1). Release name: `0.1.0 (2)`. Release notes: "First internal test build." | ☐ |
| O5 | **Add testers** | Internal testing → Testers → create an email list (yourself, plus any helpers; up to 100). Copy the opt-in link and open it on your test phone. | ☐ |
| O6 | **Store listing** | Grow → Store presence → Main store listing. Paste from `store-listing.md`: name, short and full description, icon, feature graphic, 2–8 phone screenshots. | ☐ |
| O7 | **Privacy policy** | App content → Privacy policy → `https://cheffodoggo.com/privacy` | ☐ |
| O8 | **App access** | App content → App access → paste the reviewer instructions and demo-account details from `content-rating-and-policies.md` section 4. ⚠️ Make the reviewer account first (step X4). | ☐ |
| O9 | **Ads** | App content → Ads → "No". | ☐ |
| O10 | **Content rating** | App content → Content rating → fill in the IARC form using `content-rating-and-policies.md` section 1. | ☐ |
| O11 | **Target audience** | App content → Target audience and content → **18 and over** only; "appeals to children" → No. | ☐ |
| O12 | **Data safety** | App content → Data safety → answers from `data-safety.md`. The account-deletion URL is `https://cheffodoggo.com/privacy#delete-account`. | ☐ |
| O13 | **Other declarations** | Health apps (no human health features), Financial features (none), Government (no), News (no), Advertising ID (no). See `content-rating-and-policies.md` sections 5–6. | ☐ |
| O14 | **Pricing** | Monetize → App pricing → **Free**. Do **not** create in-app products or subscriptions. Note: once an app is published as free, it cannot later be changed to paid (verify in Play Console help). | ☐ |
| O15 | **Countries / regions** | Choose where the app is available. ⚠️ OWNER: The Terms follow California law and the prices are in USD. Launching in the **United States only** first is simplest. Adding the EU/UK brings extra rules (for example the EU "trader" status declaration). Verify in Play Console help. | ☐ |
| O16 | **Developer account checks** | If the developer account is a **personal** (not organization) account created after November 2023, Google requires a **closed test with a minimum number of testers for 14 days** before production access (the numbers have changed over time, so verify the current requirement in Play Console help). Plan for this, since internal testing does not count. | ☐ |
| O17 | **Pre-launch report** | After the internal upload, open Test and release → Pre-launch report. Review crashes, accessibility and security warnings. A TWA often shows an address-bar screenshot here if assetlinks is wrong. | ☐ |
| O18 | **Promote to production** (after all device QA passes) | Create a production release from the tested build, choose countries, send for review. Consider a staged rollout (for example 20%). | ☐ |

## B. Owner does elsewhere (Windows PC, Vercel, phone)

| # | Step | Details | Done |
|---|---|---|---|
| X1 | **Build the signed bundle** | On the Windows PC, from `android-twa/`: `.\production\build-signed.ps1 -VersionCode 2 -Artifact both` (`android-twa/production/README.md`). Output: `app/build/outputs/bundle/release/app-release.aab`. | ☐ |
| X2 | **Back up the upload key** | ⚠️ OWNER: The README says **no portable backup exists yet**, because the key is tied to your Windows account. Make an encrypted backup of the keystore and its password in a place you control (for example a password manager plus an offline drive). Never put it in Git, email or screenshots. With Play App Signing, a lost upload key can be reset through Google support, but that takes time. | ☐ |
| X3 | **Confirm the live website is current** | In a signed-out phone browser, open: `https://cheffodoggo.com/privacy#delete-account` (the deletion section must show), `https://cheffodoggo.com/terms`, and `https://cheffodoggo.com/.well-known/assetlinks.json` (must show JSON, not the app's home page). | ☐ |
| X4 | **Create the reviewer demo account** | Sign up on the website with a dedicated email and tick the 18+ box. Give it Premium through a supported route (buy it on the website, or your usual complimentary method). **Do not** edit the database (`AGENTS.md`). Add the sample dog "Molly" and one saved recipe. Write the credentials into O8. | ☐ |
| X5 | **Deploy the assetlinks change** (only if E1 was needed) | After engineering updates `public/.well-known/assetlinks.json`, approve and deploy on Vercel. `AGENTS.md` says this file needs your go-ahead in GitHub issue #22. Then repeat the X3 check. | ☐ |
| X6 | **Physical-device QA** (on a real Android phone, installed from the Play internal-testing link) | Use the list below. | ☐ |
| X7 | **Screenshots** | Take them in the Play-installed app, following `store-listing.md` section 7, after the engineering fixes E2 are live. | ☐ |

### X6 – Physical-device QA list (from `android-twa/README.md`, release gate 5, plus store checks)

Install from the **Play internal-testing link**, not a sideloaded APK. A Play-signed app cannot update over the sideloaded test APK, so uninstall any sideloaded copy first. That wipes its local data, but your cloud account data is safe.

| ☐ | Check |
|---|---|
| ☐ | Opens **full screen with no browser address bar** (this proves assetlinks is correct) |
| ☐ | Fresh install → welcome screen → no prices, "Pricing" link or "Subscribe" button anywhere |
| ☐ | Existing login (sign in with an existing account) |
| ☐ | New account sign-up (18+ box required), email confirmation and password-reset links return to the app |
| ☐ | Free allowance: a free account can make exactly one treat recipe |
| ☐ | Paid-existing access: a web Premium account has full access in the app |
| ☐ | Dog profiles: create, edit, delete |
| ☐ | Meal and treat generation; ingredient restrictions and allergies respected |
| ☐ | Saved recipes: change and delete |
| ☐ | Calculator |
| ☐ | Shopping list, print and vet export |
| ☐ | Ask Cheffo Doggo chat, including the 18+ confirmation prompt on an older account |
| ☐ | "Report reply", "Report recipe" and "Report image" each save a report (check the queue in `CONTENT-REPORT-TRIAGE.md`, then delete only your test report) |
| ☐ | Cooking Mode: timer; **voice controls** work on this phone, or are cleanly hidden if unsupported; the microphone prompt comes from Chrome |
| ☐ | Settings → Download my data (a file downloads) |
| ☐ | Settings → Delete my account (use a throwaway test account, **not** the reviewer account) |
| ☐ | Android back button and in-app navigation; sign-out |
| ☐ | Offline first launch shows the offline screen with Retry; cached reload; reconnect works |
| ☐ | Links to Privacy, Terms and Help open inside the app; external links (Instacart) open outside it |
| ☐ | Tapping any Premium-only feature on a free account shows only the account-access message, never a price or purchase path |

## C. Engineering (Claude can do; each needs the owner's go-ahead where noted)

| # | Step | Details | Done |
|---|---|---|---|
| E1 | **Update `public/.well-known/assetlinks.json`** (only if O3 differs) | Replace or add the **Play app-signing** SHA-256 for `com.cheffodoggo.app`. Optionally keep the upload-key SHA-256 `9E:41…62:A2` as a second entry so the sideloaded QA APK also verifies. Remove `A8:25…` only once its origin is known. Needs the owner's go-ahead in issue #22 (`AGENTS.md`, "Hosting"). | ☐ |
| E2 | **Remove the remaining upgrade and price text from the Android build** — ✅ done in the PR that added this checklist | Android now shows no prices, pricing links, or upgrade/subscribe wording: the landing CTA reads "Create a free account"; BowlBuilder/Pantry buttons read "Included with Premium"; the Assistant placeholder and upgrade dialog state access neutrally ("… is included with Premium accounts", button "View account access"); Terms hides the price list; Help drops the money-back pitch; Learn pages remove prices and `/pricing` links when the Android marker is present. Kept on purpose for existing subscribers: Help's "What does Premium include?", refund, and "I subscribed but…" answers, and the feature list in the access dialog (information, not a purchase prompt). ⚠️ OWNER: if Play review objects, these can be hidden too. | ✅ |
| E3 | Run `npm run lint` and `npm run build` after E2, and open a draft PR (`AGENTS.md`) — ✅ both pass | | ✅ |
| E4 | **Store assets help** | Produce the 512×512 icon and 1024×500 feature graphic from existing brand files; recheck listing text lengths if edited. | ☐ |
| E5 | **Bump versionCode for any rebuild** | If a build must be redone after O4, use versionCode **3** (and so on) in `production/gradle.properties` and the build command. | ☐ |
| E6 | Keep `data-safety.md` in step with code | If any new data type ships (voice, ChatGPT plugin, affiliate links), update the Data safety answers and the privacy policy **in the same release**. | ☐ |

---

## Not required for the first release

- **Combined privacy-policy update (voice assistant + ChatGPT plugin):** not needed as long as neither feature is live for customers. The voice lab is owner-only (`docs/voice-lab.md`), and the current policy correctly describes browser-only speech (`src/pages/Legal/Privacy.tsx` lines 79–83). Publish the update **before** either feature reaches customers, and update the Data safety form at the same time (see `data-safety.md`, "When the voice assistant launches").
- Google Play Billing, in-app products and subscriptions. The Android app stays consumption-only (`android-twa/README.md`).
