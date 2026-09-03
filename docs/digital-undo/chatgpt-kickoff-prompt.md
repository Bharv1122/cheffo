# ChatGPT kickoff prompt

A self-contained prompt for starting the build with ChatGPT (or any assistant that
lacks this repo's context). It gates on choosing a name before any code is written.

**How to use it:** paste the block below. If you can, also paste `build-plan.md` and
`hackathon-sprint.md` alongside it — the prompt stands alone, but those documents carry
the reasoning behind the constraints, and an assistant will argue with rules whose
purpose it can't see.

**One failure to watch for:** the assistant will probably tell you a name or domain is
available. It cannot know that. The prompt instructs it not to; if it does so anyway,
treat that as a signal it is confabulating and push back.

---

```
I'm building a browser extension and I want your help. Two phases: settle the
name first, then scaffold the build. Do not start on code until I've picked a name.

=== THE PRODUCT ===

A local-first Chrome extension (Manifest V3) that helps people delete their own
AI chat data from ChatGPT, and gives them a "receipt" recording what was
requested, what was observed, and what remains uncertain.

The core promise: "Delete AI chats properly, with proof."

The non-negotiable honesty rule: the product NEVER claims data is "erased
everywhere," because that is not true and cannot be verified. Providers keep
backups, may retain data under legal or security obligations, and anything that
influenced a trained model cannot be removed from it. Copies, exports, forks and
screenshots are unaffected. Every claim the product makes must be either (a) our
own timestamped observation, or (b) the provider's published policy, quoted with
a source URL and date. Never a blend of the two. If you ever find yourself
writing UI copy that implies guaranteed erasure, stop and flag it.

Key verified facts (from OpenAI's help pages):
- ChatGPT chats are deleted through the UI; they disappear from view immediately
  and are scheduled for permanent deletion within 30 days, unless already
  de-identified and disassociated from the account, or retained for security or
  legal obligations.
- Deleted chats are NOT recoverable via UI, API, or support.
- Archiving is NOT deleting.
- Settings > Data Controls has "Improve the model for everyone" (turn off = new
  chats aren't used for training). Temporary Chat skips history, memory and
  training. Memory is separately controllable under Settings > Personalization.
- Data export lives in Settings > Data Controls; it emails a link, can take up to
  7 days, the link expires after 24 hours, and the zip contains conversations.json.

Assume there is NO documented public API for deleting consumer ChatGPT
conversations. Design for the documented UI path only. Do not invent, guess at,
or build on undocumented internal endpoints — if you're tempted, say so instead.

=== PHASE 1: THE NAME (do this first) ===

The current working name is "Digital Undo". I think it's wrong, because "undo"
promises reversal and the product's whole credibility rests on saying deletion is
NOT reversible and NOT provably complete.

Help me choose a better one. Requirements:
- Must not imply erasure, reversal, wiping, or guaranteed removal
- Should evoke proof, evidence, or a record
- Must not contain any provider's trademark (no "GPT", no "ChatGPT", etc.)
- Works as an extension name and in UI copy ("open your ___")

Names already ruled out because real companies own them: Vouch (startup
insurance company), Docket (multiple legal-tech companies), Paper Trail (a paper
trail is the problem, not the fix). "Receipt" is a strong candidate but
receipt.com is long gone.

IMPORTANT: you cannot check domain availability or trademarks, and neither could
the tool that got me this far. Do NOT tell me a domain or name is "available."
Instead, for each candidate, give me the exact checks to run myself (registrar,
USPTO class 9 and 42, Chrome Web Store, plain Google) and tell me what a
disqualifying result looks like.

Give me 5 candidates, each with: what it means, why it passes the honesty rule,
and its main weakness. Then recommend one and say why. Ask me to confirm before
moving on.

=== PHASE 2: THE BUILD (only after I've picked) ===

Deadline: 18 September 2026. Working demo required for a hackathon. Solo dev.

Stack: TypeScript (strict), Vite + an MV3 extension plugin, Preact or React for a
side panel, IndexedDB via idb, Zod for runtime schema validation, Vitest, Playwright.

Architecture rules:
1. ZERO EGRESS. The extension makes no network requests to any server I control.
   No analytics, no error reporting, no remote config, no licence check. The
   manifest must contain no host permission for any origin I own, so this is
   structurally verifiable by anyone reading it.
2. No message content is ever written to storage. Titles may be stored locally so
   the user can recognise what they're deleting, but titles must NEVER appear in
   a receipt — use a salted hash there.
3. Provider logic lives only in isolated "connector" modules behind a strict
   interface. The orchestrator knows about runs, plans, confirmations and
   receipts; it knows nothing about DOM selectors. A connector can only touch its
   own declared origins.
4. Host permissions are OPTIONAL and requested when the user connects a provider,
   not at install. Never request the cookies permission.
5. Two-phase execution: a scan produces an immutable Plan; the user confirms that
   exact plan (hashed); execution accepts only ids from the confirmed plan. If
   anything changed between preview and execution, halt and re-plan.
6. Fail closed. Any unexpected page state halts the run and marks the item
   unresolved. Never guess.
7. The service worker can be killed at any time — persist state after every step.

Scope for the demo, in build order:
  a. Exposure Checkup — read-only scan of the user's ChatGPT settings (training
     toggle, temporary chat, memory, export), explained in plain English, with a
     deep link to OpenAI's own control. Read and explain only; never change
     another company's settings on the user's behalf.
  b. Scan — enumerate conversations, store ids/timestamps/titles, no content.
  c. Select + Preview — user picks items; default selection is empty; a typed
     count confirms.
  d. Receipt — schema-valid, content-free, exportable JSON. Records: provider,
     item type, approved scope, timestamps, requested action, observed result,
     evidence strength, unresolved items, and the provider's retention
     disclaimer quoted verbatim with source URL and date. The "observedResult"
     field must never say "deleted" — it says what we saw
     (absent_from_list / still_present / inaccessible / indeterminate).
  e. Deletion — built LAST, behind a feature flag, off by default.

Out of scope entirely: Codex, Claude, Grok, GitHub tracing, deployments, local
files, deletion maps, DSAR generation, receipt signing, encryption, Chrome Web
Store submission.

Testing rule: ALL development and testing happens against a disposable ChatGPT
account with synthetic chats containing unique marker strings. Never my real
account. A test must confirm those marker strings never appear in storage, logs,
or receipts.

Start Phase 2 by giving me the project structure and the connector interface as
TypeScript types. Then we'll build the Exposure Checkup first. Ask me questions
when something is ambiguous rather than assuming.
```

---

## Keeping this in sync

The prompt duplicates constraints that live in `build-plan.md` (§1.5 honesty boundary,
§2.2 architecture decisions, §4 connector interface, §7 receipt format) and
`hackathon-sprint.md` (scope, deadline, disposable-account rule). If those change,
change this too — a stale prompt will quietly send the build in the wrong direction.

If the name gets settled, update the "current working name" line in Phase 1 rather
than deleting the phase, so the reasoning survives for anyone picking this up later.
