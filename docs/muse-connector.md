# Muse connector (MCP) — submission packet

Draft only. **Nothing has been submitted to Meta.** Beth submits at muse.ai/platform once the endpoint is live in production and she's happy with it.

The form fields below follow the brief (Existing MCP endpoint or OpenAPI; auth = API key or OAuth 2.1 + PKCE). I couldn't open muse.ai/platform from the build container, so the exact field names on the real form are **unverified**. Map these values onto whatever the form asks for.

## Form values

| Field | Value |
| --- | --- |
| Integration type | Existing MCP endpoint (Streamable HTTP) |
| Endpoint URL | `https://cheffodoggo.com/api/mcp` (live only after this PR is merged and deployed) |
| Authentication | None for v1. All tools are public and use no user data. OAuth 2.1 + PKCE is only needed later, if account tools are added. |
| Name | Cheffo Doggo |
| Short description | Homemade dog food help: check if a food is safe for dogs, estimate daily calories, and get a homemade treat idea. |
| Long description | Cheffo Doggo helps dog owners cook at home. Ask whether a food is safe for dogs, get a starting daily-calorie estimate from your dog's weight, life stage and activity, or get a homemade treat idea from a vetted catalog. Answers come from Cheffo Doggo's own reference data, not guesses. When a food isn't on the list, it says so. Educational guidance only, not veterinary advice. |
| Icon (512×512) | `public/muse-icon-512.png` → `https://cheffodoggo.com/muse-icon-512.png` after deploy. Resized from `public/cheffo-doggo-logo.png`. |
| Website | `https://cheffodoggo.com` |
| Privacy policy URL | `https://cheffodoggo.com/privacy` |
| Terms URL | `https://cheffodoggo.com/terms` |
| Support contact | `support@cheffodoggo.com` (the address on the Privacy and Terms pages) |
| Category | Food & cooking / Pets |

### Example prompts (pick 3–5)

1. "Can my dog eat grapes?"
2. "Is plain canned pumpkin OK for dogs?"
3. "How many calories does my 30 lb adult dog need a day?"
4. "Give me a frozen treat idea for my dog without yogurt."
5. "My puppy weighs 12 pounds. Roughly how many calories should she get?"

## Tools

All three are read-only (`readOnlyHint: true`, `openWorldHint: false`), take no account and call no paid API or LLM. Every answer ends with: *"Educational info only, not veterinary advice. Check with your veterinarian before changing your dog's diet."*

| Tool | Input | What it returns | Source |
| --- | --- | --- | --- |
| `check_food_safety` | `food` (1–80 chars) | toxic / not recommended / small amounts only / caution / generally dog-safe / **unknown**, with the reason. Toxic foods include ASPCA Animal Poison Control (888-426-4435). | `src/data/toxicIngredients.ts`, `src/data/assistantKnowledge.ts` |
| `daily_calorie_estimate` | `weight`, `unit` (lb/kg), `life_stage`, optional `activity_level` | kcal/day from RER × multiplier, plus the RER, labelled as an estimate | `src/utils/calculator.ts` (same maths as the app) |
| `treat_idea` | optional `category`, `avoid[]` (≤10), `pick` | a catalog treat with its **full** ingredient list and no amounts; amounts are portioned per dog in the app | `src/data/treatCatalog.ts` |

Safety and copy rules (checked by `scripts/verify-mcp-tools.mjs`):

- No cure / prevent / heal / "treats <condition>" wording. Benefit text from the knowledge base isn't passed through for safe foods.
- Unknown foods return "not in our list, that doesn't mean it's safe" rather than a guess.
- Whole-word matching, so "pineapple" isn't read as "apple" and "steak" isn't read as "tea".
- No quantities that aren't already in the source data. Treat ideas never include amounts.

## Security / privacy

- **No auth, no user data.** Stateless: a fresh server per request and no session store.
- **Input validation:** zod schemas with length and range limits. Control characters and `<>` are stripped before input is echoed back.
- **Body cap:** 16 KB (413 above that).
- **Rate limits:** 40 requests/min per IP per instance (in memory, always on), plus the shared Supabase per-IP limiter (60/min, scope `mcp`, salted IP hash) used by the other public endpoints. The shared limiter fails open if Supabase is down, and the in-memory limit still applies.
- **Logs:** JSON-RPC method, status and duration only. No tool arguments, no IPs.
- **No secrets in the client:** the endpoint lives in `/api` and never ships to the browser.

## Before submitting — checklist for Beth

- [ ] Merge and deploy. Then check `POST https://cheffodoggo.com/api/mcp` answers `initialize` / `tools/list`. It runs on the Edge runtime like the other functions, with the eval-free @cfworker JSON-schema validator. `npm run verify:mcp-edge` runs the bundled handler in Vercel's `edge-runtime` sandbox, and the PR preview deploy answers GET with 405 as designed. A full POST against a deploy wasn't possible from the build container.
- [ ] Try it from a real MCP client, e.g. `npx @modelcontextprotocol/inspector` → Streamable HTTP → the URL above.
- [ ] Check `/privacy` and `/terms` load on the live site. They exist as public routes in the app (`src/App.tsx`), are listed in `public/sitemap.xml`, and render "Privacy Policy" / "Terms of Service" in a local production build. **The live URLs couldn't be fetched from the build container (egress blocked), so live status is unverified.**
- [ ] Optional: the Privacy Policy already covers hashed IPs for rate-limiting public endpoints. It doesn't specifically mention requests from AI assistants such as Muse (tool inputs are processed per request and not stored). Consider one sentence on that before submitting.
- [ ] Upload `muse-icon-512.png` and paste the values above.

## Run the checks locally

```bash
npm run verify:mcp-tools   # drives api/mcp.ts through the official MCP client, no network
npm run verify:mcp-edge    # bundles it and runs it in Vercel's edge-runtime sandbox
```
