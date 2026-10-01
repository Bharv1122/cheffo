# Google Play store listing – Cheffo Doggo

Prepared 2026-09-30 for the first Android release (package `com.cheffodoggo.app`). Everything here is copy you can paste into **Play Console → Grow → Store presence → Main store listing**. Character counts were measured with a script, not estimated.

**Ground rules for this listing (why the text is written this way)**

- The Android app is "consumption-only": it shows no prices, no purchase buttons and no "buy / subscribe / upgrade" calls to action. People who already have Premium from the website keep it. The listing follows the same rule.
- No medical or vet-endorsement claims. Cheffo Doggo does not employ vets and vets do not endorse it (see `src/pages/Legal/Terms.tsx`, "Vet approval workflow"). The listing says "share with your own vet", never "vet-approved" or "vet-recommended".
- No "safe" promises. The app checks recipes against a toxic-ingredient list and the dog's allergies, and the listing describes exactly that instead of saying "every recipe is safe".
- Recipe text is built from vetted templates on the device (`src/utils/guestTreat.ts` header comment, `src/utils/recipeGenerator.ts`). AI is used for the chat assistant and for recipe artwork. The listing does not claim that AI writes the recipes.

---

## 1. App name (max 30 characters)

| Option | Text | Characters |
|---|---|---|
| **Recommended** | `Cheffo Doggo` | 12 |
| Alternative | `Cheffo Doggo: Dog Food Recipes` | 30 (exactly at the limit) |

⚠️ OWNER: Choose the name. "Cheffo Doggo" matches the name inside the app (`android-twa/app/build.gradle`, release `app_name`) and the website. The longer option can help people find the app in search, but Play discourages stuffing keywords into titles. If you choose it, keep it exactly as written. Verify the current title rules in Play Console help.

## 2. Short description (max 80 characters)

**Recommended (70 characters):**

> Homemade dog food recipes, portions and batch plans made for your dog.

Alternative (72 characters):

> Personalized homemade dog food recipes, portions and weekly batch plans.

## 3. Full description (max 4,000 characters)

**Length: 2,705 characters** (measured with `wc -m`). It contains no prices and no buy, subscribe or upgrade call to action.

```text
Cook homemade food for your dog with a plan you can actually follow.

Cheffo Doggo helps dog owners plan and cook simple homemade meals, toppers and treats. Tell it about your dog once, and every recipe is shaped around your dog's weight, age, life stage, activity level and the foods you want to avoid.

WHAT YOU CAN DO
• Dog profiles – add each of your dogs with weight, age, breed, allergies, medications and foods to avoid.
• Recipes for your dog – full meals, weekly batches, toppers, treats and pantry-based recipes built from more than 60 recipe templates.
• Ingredient checks – recipes are checked against a list of ingredients commonly considered toxic to dogs (such as chocolate, grapes, raisins, onion, garlic and xylitol) and against the allergies and foods to avoid in your dog's profile.
• Portion calculator – estimate daily calories and portion sizes from your dog's weight and activity level.
• Cook once, feed all week – batch plans with container counts, per-meal portions, fridge and freezer notes, and one shopping list.
• Cooking Mode – one step at a time, with a built-in kitchen timer and optional voice controls where your device supports them.
• Ask Cheffo Doggo – an AI assistant for questions about homemade dog food, portions and ingredient swaps, answered with your dog's profile in mind.
• Share with your own vet – create a printable vet packet with ingredients, portions and supplement notes, or email a review request to your own veterinarian.
• Report content – flag any recipe, image or assistant reply that looks wrong or inappropriate, right inside the app.

YOUR ACCOUNT
Create a free account to save your dog profiles and recipes and to make one free treat recipe. Some features, including full meals, weekly batches, pantry recipes, vet packets and the AI assistant, are available only to accounts that already include Cheffo Doggo Premium. Sign in with your existing account to use everything already included with it.

PRIVACY
You can download your account data or delete your account at any time from Settings. We don't show ads and we don't sell your data.

IMPORTANT
Cheffo Doggo is educational guidance for home cooking. It is not veterinary advice and is not a substitute for care from a licensed veterinarian. It does not diagnose, treat, cure or prevent any condition. Talk with your veterinarian before changing your dog's diet, especially for puppies, seniors, pregnant or nursing dogs, and dogs with medical conditions or on prescription food. Recipes and AI replies can contain mistakes, so please review them before cooking.

Cheffo Doggo is for adults aged 18 and over.

Questions? Email support@cheffodoggo.com.
```

⚠️ OWNER: The "YOUR ACCOUNT" paragraph says that some features are available only to accounts that already include Premium. This is honest and does not tell anyone how to buy. It also sets expectations, because a brand-new Android user only gets profiles, the calculator, saved recipes and one free treat recipe (`src/pages/Legal/Terms.tsx`, "Free tier"). If you would rather not mention Premium at all, replace that paragraph with: *"Sign in with your Cheffo Doggo account to use everything already included with it. New accounts can save dog profiles and make one free treat recipe."* Verify in Play Console help whether naming a paid tier in a consumption-only app's listing is acceptable. (I believe it is when there is no price and no instruction to buy, but I could not confirm this.)

**Words to avoid in any listing text, screenshot caption or promo graphic:** "vet-approved", "vet-recommended", "veterinarian-formulated", "clinically", "guaranteed safe", "cures", "treats [a condition]", "healthier than kibble", "subscribe", "upgrade", "buy", "free trial", "$", "per month", "money-back guarantee", "best", "#1". Play's metadata policy also bans testimonials and performance claims in the title and icon (verify the current wording in Play Console help).

## 4. Category and tags

| Field | Recommendation | Why |
|---|---|---|
| App or game | App | |
| Category | **Food & Drink** | The app is about cooking recipes. **Lifestyle** is the fallback if the reviewer disagrees. |
| Tags (chosen in Play Console from Google's fixed list) | Pick up to 5 that exist in the picker, such as: Recipes, Cooking, Pets / Pet care, Meal planning, Nutrition | Tags are chosen from a fixed list in Play Console, so these exact names may not all appear. Verify in Play Console help. Avoid any "Medical" or "Health" tags. |

⚠️ OWNER: Confirm Food & Drink versus Lifestyle.

## 5. Contact details and links

| Field | Value |
|---|---|
| Email (required, public) | `support@cheffodoggo.com` |
| Website | `https://cheffodoggo.com` |
| Phone (optional) | ⚠️ OWNER: leave blank unless you want a public phone number |
| Privacy policy URL | `https://cheffodoggo.com/privacy` |
| Account-deletion URL (asked in the Data safety form) | `https://cheffodoggo.com/privacy#delete-account` (see `data-safety.md`) |

⚠️ OWNER: Before submitting, open both URLs on a phone that is **not** signed in and confirm that they load. The privacy page must show the "Delete your account" section with the support email. The code has this section (`src/pages/Legal/Privacy.tsx` lines 157–184, effective date September 23, 2026), but I could not check the live website from here.

## 6. Graphics you need

| Asset | Play requirement (verify in Play Console help) | Source |
|---|---|---|
| App icon | 512 × 512 PNG, 32-bit | Start from `public/pwa-512.png` or `public/cheffo-doggo-logo.png`. It should match the launcher icon. |
| Feature graphic | 1024 × 500 JPG or PNG | Needs to be made. Logo, name and the tagline "Homemade meals. Made for your dog." (from the landing page). No prices, no "vet-approved" wording. |
| Phone screenshots | 2–8 images, 16:9 or 9:16, each side 320–3840 px | See the shot list below |

Do not use `public/demo-poster-v2.png`. `docs/promotion-packet-2026-09-23.md` marks it untrustworthy because it mixes beef, turkey and chicken.

## 7. Screenshot shot list (phone, portrait)

Capture these **inside the installed Android app** (the Play-signed internal-testing build), not in a desktop browser. That way no prices or "Pricing" links appear. Use a demo account with Premium access and a realistic sample dog (for example "Molly, 42 lb adult"). Hide the status bar clock and notifications, or use a clean device.

| # | Screen (route) | What to show | Caption (overlay text) |
|---|---|---|---|
| 1 | Landing / Home (`/`) | Hero image of the dog beside a bowl, with the headline "Homemade meals. Made for your dog." | Homemade meals, made for your dog |
| 2 | Dog profile (`/profiles/:id/edit`) | A filled-in profile: weight, life stage, activity, an allergy and one food to avoid | One profile shapes every recipe |
| 3 | Bowl Builder (`/bowl-builder`) | Recipe-type picker (full meal, weekly batch, topper, treat) with the dog selected | Meals, toppers, treats and weekly batches |
| 4 | Recipe detail (`/recipes/:id`) | Ingredient amounts, per-meal portion, container count, and a visible "Report recipe" button if it fits | Exact amounts and portions for your dog |
| 5 | Cooking Mode (`/cook/:id`) | One large step with the timer running | Cook step by step, with a built-in timer |
| 6 | Calculator (`/calculator`) | Daily calorie and portion estimate for the sample dog | Estimate daily calories and portions |
| 7 | Ask Cheffo Doggo (`/assistant`) | One question and answer, such as "Can I add eggs to recipes?", with the "Report reply" link visible | Ask questions about homemade dog food |
| 8 | Vet export (`/vet-export/:id`) | The printable vet packet with ingredients, portions and supplement notes | Share the plan with your own vet |

Rules for every screenshot:

- No screen may show "$", "Premium" upsell cards, "Upgrade to …" buttons, "Subscribe for weekly batches" or a Pricing link. Several of these still appear in the Android build today (see the risks in `launch-checklist.md`), so check each image.
- Caption text must not claim safety, vet endorsement or health results.
- Do not photograph or type real customer data. Create the sample dog in the demo account.
- For Ask Cheffo Doggo, pick an answer that tells the user to check with their vet where relevant, and read it carefully before using it.

⚠️ OWNER: Decide whether to include screenshot 7 (AI chat). It shows off the feature, but any AI answer shown in a store image becomes something you are presenting as accurate. Check it word for word.
