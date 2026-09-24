# Hackathon Sprint — 3 to 18 September 2026

**Target:** Vibe Coding Academy, September hackathon. Working demo required.
**Deadline:** 18 September 2026. **15 days.**
**Testing:** disposable ChatGPT account with synthetic chats only. No real account, ever, at any point.

Companion to `build-plan.md`. That document is the product; this one is the fortnight.

---

## The demo, decided now

**Exposure Checkup → Scan → Preview → Receipt.** Deletion is built but demoed only if Day 12 says it is safe.

This is the honest half of the product and the safe half at the same time. Nothing irreversible happens on stage.

**The 60-second pitch:**

> Everyone tells you to delete your AI chats. Nobody tells you two things. First: your account is probably still set to feed everything you type into the next model — and once that has happened, deletion doesn't reach it. Second: when you do delete, you get no proof. Digital Undo shows you what your accounts are set to do, helps you clean up, and gives you a receipt that says exactly what happened and — this is the part nobody else will say — exactly what it cannot promise.

---

## Scope

### In

1. **Exposure Checkup** — read-only scan of provider settings (training toggle, temporary chat, memory, export), plain English, deep-link to the provider's own control
2. **Scan** — enumerate conversations in the disposable account
3. **Select + Preview** — pick items, see exactly what would be affected
4. **Receipt** — schema-valid, content-free, exportable
5. **Honesty copy** — first-run, confirmation, receipt

### Built but flagged off by default

6. **Deletion** — real, on the disposable account. Ships behind a flag. Go/no-go on Day 12.

### Out — do not build, do not discuss

Codex connector, Claude, Grok, GitHub tracing, deployments, local files, deletion map, erasure-request generator, receipt signing, encryption, resume-after-crash, Chrome Web Store submission.

The deletion map and the DSAR generator are the two most tempting cuts to un-cut. Both are in the plan. Neither is in this fortnight.

---

## Schedule

| Days | Dates | Work | Done when |
|---|---|---|---|
| **1–2** | Sep 4–5 | Provider facts: open every OpenAI help page, screenshot, date it. Create disposable account. Seed ~120 synthetic chats with marker strings. | `docs/provider-facts/openai.md` exists; account has enough chats to need paging |
| **3–5** | Sep 6–8 | Extension skeleton (Vite + MV3 + side panel). Connector interface. **Exposure Checkup** reading ChatGPT settings. | Checkup reports the real state of the disposable account's settings |
| **6–8** | Sep 9–11 | Scan + local inventory + selection UI. No content stored, marker-string test passing. | Full chat list enumerates twice with identical results |
| **9–10** | Sep 12–13 | Preview screen, plan hashing, receipt writer + export. | A schema-valid receipt with reconciling counts |
| **11–12** | Sep 14–15 | Deletion path on the disposable account. Rate-limited, Stop button, verify by reload + direct URL. | **GO/NO-GO — see below** |
| **13** | Sep 16 | **SCOPE FREEZE.** Polish, honesty copy, empty states, the demo path only. | No new features after this point |
| **14** | Sep 17 | Demo script. Rehearse 3×. **Record a backup video.** | Video exists |
| **15** | Sep 18 | Submit. | Submitted |

### Go/no-go on deletion — Day 12, end of day

Ship deletion in the demo only if **all** are true:

- 25 items deleted on the disposable account with zero items touched outside the confirmed list
- The Stop button works mid-run
- Verification (gone after reload, URL 404s) is reliable
- Nothing about it feels shaky

Any doubt → flag it off, demo the checkup and scan, and say so out loud. "The deletion path is built and specified; it isn't in this demo because it's irreversible and I won't show you something I haven't tested properly." **That answer wins more judges than a demo that half-works.**

---

## Rules that don't bend

1. **Disposable account only.** Not your account, not a friend's, not "just to show the volume."
2. **Marker-string test runs before every demo.** Synthetic chats contain unique strings; if one appears in storage, a log, or a receipt, that's a stop-everything bug.
3. **Zero egress stays true.** No analytics, no error reporting, no "just for the demo" telemetry. It's the core claim.
4. **The honesty paragraph ships in the demo.** It is not polish to be cut on Day 13. It is the product.
5. **Record the backup video on Day 14.** Live demos fail. Wifi fails. Accounts get rate-limited on stage.

---

## Cut list, in order

When you fall behind — and you will — cut in this order:

1. Receipt export formatting (JSON only, no pretty PDF)
2. Search and filtering in the selection UI (a plain list is fine)
3. Deletion (fall back to the go/no-go answer above)
4. Multi-provider UI shell (one provider card is fine)

**Never cut:** the Exposure Checkup, the receipt, or the honesty copy. Those three *are* the demo.

---

## Judge questions to have answers ready for

- *"Does this actually delete everything?"* — No, and nothing can. Backups, legal holds, and trained-model influence are outside any tool's reach. That's why there's a receipt instead of a promise.
- *"What's stopping OpenAI from breaking this?"* — Nothing. It's UI automation, it will break, and the plan has a guided-manual fallback for when it does.
- *"Where does my data go?"* — Nowhere. Read the manifest; there's no permission for any server we own.
- *"Why would I use this over just clicking delete?"* — The checkup, the selectivity, and the receipt. Clicking delete is easy; knowing what you actually changed is not.
- *"Is this legal?"* — It's a user acting on their own account in their own browser. Whether OpenAI's terms permit automating it is an open question and is question 1 in the plan. Don't bluff this one.
