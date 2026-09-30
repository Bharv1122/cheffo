# Voice Lab (owner-only)

A hidden page at `/voice-lab` for comparing realtime voice providers in a real kitchen before building a voice assistant into Cooking Mode. Customers cannot use it: the server only issues sessions to accounts listed in `VOICE_LAB_ALLOWED_EMAILS`, and with that unset the endpoint answers 404.

## Setup (Vercel → Project → Settings → Environment Variables)

| Variable | Needed for | Notes |
|---|---|---|
| `VOICE_LAB_ALLOWED_EMAILS` | Turning the lab on | Comma-separated sign-in emails, e.g. your own |
| `GEMINI_API_KEY` | Gemini Live | Optional if `LLM_BASE_URL` already points at Google; the existing `LLM_API_KEY` is reused |
| `OPENAI_API_KEY` | OpenAI Realtime | From platform.openai.com (API billing, separate from a ChatGPT subscription) |
| `VOICE_GEMINI_MODEL` | Optional | Default `gemini-3.8-live` |
| `VOICE_OPENAI_MODEL` | Optional | Default `gpt-realtime-2.1-mini` |
| `VOICE_OPENAI_TRANSCRIBE_MODEL` | Optional | Default `gpt-4o-mini-transcribe` (only used for the on-screen transcript) |

Redeploy after changing variables. If a provider rejects a model name, the lab shows the provider's error so the variable can be corrected without a code change.

## Running a test

1. Sign in on your phone with an allowlisted account and open `/voice-lab`.
2. Pick a provider and one of your saved recipes, tap **Start talking**, allow the microphone.
3. Cook for a few minutes with the phone on the counter. Try: "what's next?", "set a timer for 10 minutes", interrupting mid-answer, asking a swap question, and asking something unsafe (grapes, raw chicken) to check it refuses.
4. Tap **Stop**, rate the session, repeat with the other provider.
5. **Copy** exports the saved results as a table.

Each session counts against the daily AI limit, stops automatically after 15 minutes, and uses a single-use credential that must be used within 60 seconds.

## What the numbers mean

- **Avg reply delay**: time from when you stop talking to when Chef starts speaking, measured the same way on the phone for both providers.
- **Est. cost**: your measured talk time × each provider's list per-minute price. It ignores context re-reading, so treat it as a floor and confirm on each provider's billing page.

## Before this becomes a customer feature

- Update the privacy policy and Google Play Data Safety answers: microphone audio would go to the chosen AI provider, not only the browser's speech service.
- Gate it to Premium with a monthly voice-minute cap.
- OpenAI's browser credential does not lock the instructions the way Gemini's constrained token does, so a production OpenAI build would need a server-side control channel. The lab is owner-only, so this does not apply yet.
- Test on the Android app, not just the phone browser.
