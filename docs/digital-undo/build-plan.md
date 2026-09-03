# Digital Undo — Build Plan (v0.1, draft for review)

**Promise:** *Delete AI chats properly, with proof.*

**Status:** Planning document only. Nothing has been built. No code, no accounts, no provider integrations.

**Date:** 2026-09-03

---

## How to read this document

Two audiences share one document.

- **If you are the founder:** read sections 1, 3 (first half), 5, 9, 11, 12, 16 and 17. That is the product, the honest limits, the first test, and the decision.
- **If you are the developer:** read everything, and treat sections 2, 4, 6, 7, 8, 10 and 15 as the spec you would estimate from.

Every factual claim about a provider is tagged:

- **[VERIFIED]** — found in the provider's own published documentation, cited at the end.
- **[ASSUMPTION]** — a reasonable belief that has *not* been confirmed and must be tested in Week 1.
- **[FRAGILE]** — depends on undocumented behaviour or on a web page's structure, which can change without notice.

A hard rule for this project: **we never ship a claim we have not verified, and we never build on an undocumented API we have pretended is a product surface.**

### One caveat about this document's own research

The research for this draft was done through web search, which returned summaries of official provider pages. Direct fetching of `help.openai.com` was blocked by the network in this environment, so the quotes below come from search results *about* those official pages rather than from the pages opened directly. Everything marked **[VERIFIED]** should be re-opened by a human, screenshotted, and dated before it appears in any marketing copy. Treat this document's verification level as "strong evidence, pending human sign-off."

---

## 1. Product definition and boundaries

### 1.1 What it is

Digital Undo is a **local-first browser extension** that helps a person delete their own AI chat data from the AI services they already use, and then hands them a **receipt** describing what was requested, what was observed, and what remains uncertain.

It is a *cleanup assistant with an audit trail*. It is not a data broker, not a background agent, and not a service that holds your chats.

### 1.2 The three things it actually does

1. **Scan** — with the user signed in to a provider in their own browser, enumerate what exists (chats, projects, tasks) and build a local inventory.
2. **Preview** — show a plain list of exactly what would be deleted, plus a *deletion map* of related artifacts the user may also want to handle (repos, deployments, files), each labelled by confidence.
3. **Delete and record** — after one explicit confirmation, perform the provider's own documented deletion action for each selected item, re-check the visible result, and write a local receipt.

### 1.3 What it explicitly is not

| Not this | Why |
|---|---|
| A "your data is erased everywhere" guarantee | Impossible and untrue. See §1.5. |
| A cloud service that stores chats | Storing chat content to help delete chat content is self-defeating and a breach magnet. |
| A standing agent with persistent delete authority | The user grants scope per run, per provider, and it expires. |
| A legal compliance product | It can *support* a DSAR; it is not a DSAR and makes no legal representation. |
| A tool for deleting other people's data | Own-account only. Enterprise/admin deletion is out of scope for the MVP. |
| A model-unlearning tool | Nothing can pull a chat back out of a trained model. |

### 1.4 Who it is for (MVP)

Individual developers and privacy-conscious professionals who have used ChatGPT and Codex for real work, have accumulated hundreds or thousands of chats, and want to clear specific material — a client name, a credential they pasted, an ex-employer's codebase — and be able to show they did.

### 1.5 The honesty boundary (non-negotiable product copy)

This text, or something very close to it, appears in the product before the first scan, again on the confirmation screen, and again on every receipt:

> **What this can and cannot do.** We ask the provider to delete the items you selected, using the provider's own delete function, and we record what we saw. We cannot guarantee data is gone everywhere. Providers keep backups and may retain data for legal, security, or operational reasons. Copies you or others made — downloads, exports, forks, screenshots, other people's accounts, search-engine caches, and anything outside the accounts you authorised — are not affected. Content that influenced a trained model cannot be removed from that model. This receipt records a request and an observation, not an erasure.

If a growth or marketing decision ever requires softening that paragraph, the correct answer is to lose the growth. The entire value of a receipt is that it does not lie.

### 1.6 Success definition for v1

A user can, in under ten minutes, delete a chosen set of ChatGPT and Codex chats, see a truthful receipt, and understand precisely what remains unknown — with no chat content ever leaving their machine.

---

## 2. Architecture for a local-first Chrome extension

### 2.1 Shape

```
┌──────────────────────────────── Chrome (user's profile) ───────────────────────────────┐
│                                                                                        │
│  ┌──────────────┐   messages   ┌──────────────────────┐   IndexedDB   ┌──────────────┐ │
│  │  UI surface  │◀────────────▶│  Service worker      │◀─────────────▶│ Local store  │ │
│  │ (side panel  │              │  = Orchestrator      │               │ inventory,   │ │
│  │  + options)  │              │                      │               │ plans,       │ │
│  └──────────────┘              │  - run state machine │               │ receipts     │ │
│                                │  - scope tokens      │               └──────────────┘ │
│                                │  - receipt writer    │                                │
│                                └──────────┬───────────┘                                │
│                                           │ strict connector API                       │
│                       ┌───────────────────┼───────────────────┐                        │
│                       │                   │                   │                        │
│                ┌──────▼──────┐     ┌──────▼──────┐     ┌──────▼──────┐                 │
│                │ chatgpt     │     │ codex       │     │ (future)    │                 │
│                │ connector   │     │ connector   │     │ claude/grok │                 │
│                └──────┬──────┘     └──────┬──────┘     └─────────────┘                 │
│                       │ content script only on its own origin                          │
│                ┌──────▼─────────────────────────────────────────┐                      │
│                │ chatgpt.com tab — user's existing session       │                      │
│                └────────────────────────────────────────────────┘                      │
└────────────────────────────────────────────────────────────────────────────────────────┘

           No network egress from the extension to any Digital Undo server. None.
```

### 2.2 The load-bearing decisions

**a. The extension never holds provider credentials.** It acts inside a tab where the user is already logged in, using the browser's own session. There is no token vault, no OAuth for the MVP, nothing to steal from us. This single decision removes most of the threat model.

**b. Zero egress in v1.** The extension makes no requests to any origin we control. Not telemetry, not crash reports, not licence checks. The manifest declares no host permission for our own domain, so this is *structurally* true and auditable by anyone reading the manifest — not a promise. **[ASSUMPTION → must hold]**: monetisation for v1 is either free, or a one-off licence checked outside the extension (e.g. a signed key pasted in). Anything requiring a phone-home changes this document.

**c. Content stays out of storage.** The scan stores *identifiers and metadata* — conversation id, title hash, created/updated timestamps, URL, counts. It does **not** store message bodies. Titles are the one exception, because the user must be able to recognise what they are deleting; titles are stored, shown, and then **not** copied into the receipt (see §7).

**d. Orchestration lives in the service worker; provider knowledge lives only in connectors.** The orchestrator knows about *runs, plans, confirmations, receipts*. It knows nothing about DOM selectors or provider endpoints. A connector knows only its own provider and can only be reached through the interface in §4.

**e. Everything is a two-phase plan.** Scan produces a `Plan`. A `Plan` is immutable once shown. Confirmation signs *that exact plan*. If anything changes between preview and execution (new chats appeared, an item vanished), the run halts and re-plans rather than deleting something the user did not see. This is the mechanism that makes "show exactly what will be affected" real rather than decorative.

**f. Fail closed.** Any ambiguity — unexpected page state, unknown response, a selector that matched two things — stops that item, marks it `unresolved`, and continues with the rest. We never guess our way through a deletion.

### 2.3 Manifest V3 constraints we design around

- **No remotely hosted code.** All logic ships in the package **[VERIFIED]**. Connectors therefore cannot be "updated over the air" when a provider changes their UI; a provider change means a new store release. Plan for that release cadence.
- **Service workers are ephemeral.** They are terminated when idle. A long deletion run must persist its state to IndexedDB after every single step and be resumable, not held in memory.
- **Host permissions trigger install-time warnings** and should be optional where possible **[VERIFIED]**. See §8.

### 2.4 What we deliberately do not build

No native messaging host in v1 (that is Phase 4, for local-file tracing). No background scheduling. No auto-delete rules. No "clean everything" button. Each of those is a way to delete something the user did not intend.

---

## 3. Threat model and privacy model

### 3.1 What we are protecting

1. **The chats themselves**, in the window between scanning and deleting.
2. **The receipt**, which is a map of what a person wanted gone — arguably more sensitive than any single chat.
3. **The user's account**, from a tool with delete authority behaving badly.

### 3.2 Adversaries and mitigations

| Adversary | Attack | Mitigation |
|---|---|---|
| Us, later | Product pressure adds analytics that ships chat metadata | Zero-egress manifest; a reviewer can diff `host_permissions`. Any change is visible in the store listing diff. |
| Malicious extension update (us compromised) | A future version exfiltrates | Reproducible builds, source published, release signing by two people, short changelogs. Cannot fully solve; disclose it. |
| Another extension on the machine | Reads our IndexedDB | It cannot — extension storage is origin-isolated. But it *can* read the provider page. Note in threat docs; not our vector to fix. |
| A compromised provider page (XSS on chatgpt.com) | Feeds our content script fake data, or tricks the orchestrator into deleting more | Content script treats all page data as untrusted input; plan is built from parsed data but *confirmed by the user by title*; execution is capped at the confirmed id list. A hostile page cannot expand the id list after confirmation. |
| The user's own device thief | Reads receipts | Receipts stored locally; optional passphrase encryption at rest for the receipt store; explicit "delete all receipts" control. |
| A curious third party | Wants proof of what the user deleted | Receipts never auto-sync anywhere. Export is a manual, deliberate action. |
| Us being subpoenaed | Asked to hand over user deletion history | We hold nothing. This is the strongest privacy property we have and should be stated plainly. |

### 3.3 Privacy model, stated as invariants

The following are testable invariants, and each gets an automated test:

1. **I1 — No egress.** The extension's manifest contains no host permission for any origin we control, and no runtime code calls `fetch` to a non-provider origin. *Test: static scan of the bundle + a network-recording integration test asserting zero requests off-provider.*
2. **I2 — No message bodies at rest.** No field in the local store is typed to hold message content. *Test: schema assertion + a fuzz test that a scan of a synthetic account with a distinctive marker string never writes that string to storage.*
3. **I3 — No content in receipts.** Receipt schema is closed (`additionalProperties: false`) and contains no free-text field derived from chat content. *Test: schema validation on every receipt written; property test with marker strings.*
4. **I4 — No deletion without a signed plan.** Execution accepts only a plan hash that matches a confirmation record. *Test: unit test that a mutated plan is rejected.*
5. **I5 — Scope isolation.** A connector cannot be invoked for a URL outside its declared origins. *Test: unit test that the chatgpt connector rejects a claude.ai target.*

### 3.4 Data classes

| Class | Example | Stored? | In receipt? |
|---|---|---|---|
| Message content | What you typed | **Never** | Never |
| Titles | "Refactor billing service" | Yes, locally, until the run ends | No — replaced by a salted hash |
| Identifiers | conversation id | Yes | Yes (truncated or hashed — see §7) |
| Metadata | timestamps, counts, URLs | Yes | Yes |
| Observations | "list no longer contains id X" | Yes | Yes |
| Credentials | session cookies | **Never touched or read** | Never |

---

## 4. Provider-connector interface (isolation by construction)

### 4.1 The rule

Each provider is a separate module with its **own** origin permission, its **own** capability declaration, and **no** access to any other connector's data or permissions. If the Claude connector is compromised or buggy, it cannot touch ChatGPT. "All in one, but separate" is enforced by the interface, not by good intentions.

### 4.2 The interface (TypeScript sketch)

```ts
/** Everything a connector may ever do is enumerated here. */
type Capability =
  | 'list_conversations'
  | 'list_projects'
  | 'delete_conversation'
  | 'archive_conversation'
  | 'verify_absence'
  | 'export_request'
  | 'discover_artifacts';

interface ConnectorManifest {
  id: 'chatgpt' | 'codex' | 'claude' | 'grok' | 'github' | string;
  displayName: string;
  /** Exact origins this connector may ever touch. Enforced by the host. */
  origins: string[];                       // e.g. ['https://chatgpt.com/*']
  capabilities: Capability[];
  /** Which method each capability uses, so the UI can warn honestly. */
  method: Record<Capability, 'documented-ui' | 'documented-api' | 'observed-endpoint' | 'dom-automation'>;
  /** Provider's own published retention statement, shown verbatim in receipts. */
  retentionDisclaimer: { text: string; sourceUrl: string; verifiedOn: string };
  /** Requires a fresh user gesture per run. */
  requiresPerRunConsent: true;
}

interface ScopeGrant {
  connectorId: string;
  runId: string;
  allowedItemIds: string[];   // exact ids, never wildcards
  allowedActions: Capability[];
  expiresAt: number;          // short: minutes, not days
  planHash: string;           // ties the grant to what the user saw
}

interface Connector {
  manifest: ConnectorManifest;

  /** Read-only. Must not mutate provider state. */
  scan(ctx: RunContext): AsyncIterable<InventoryItem>;

  /** Read-only. Proposes edges for the deletion map, each with confidence. */
  discover?(ctx: RunContext, items: InventoryItem[]): AsyncIterable<MapEdge>;

  /** Acts on exactly one item. Host refuses to call it without a matching ScopeGrant. */
  execute(ctx: RunContext, item: InventoryItem, action: Capability, grant: ScopeGrant): Promise<ActionOutcome>;

  /** Re-checks the provider's visible state after execute. Never destructive. */
  verify(ctx: RunContext, item: InventoryItem): Promise<VerificationResult>;
}

type ActionOutcome = {
  status: 'succeeded' | 'failed' | 'skipped' | 'unresolved';
  evidence: Evidence[];
  providerMessage?: string;   // sanitised, length-capped
};

type VerificationResult = {
  observation: 'absent_from_list' | 'still_present' | 'inaccessible' | 'indeterminate';
  strength: 'strong' | 'moderate' | 'weak';
  checkedAt: number;
};
```

### 4.3 Host-enforced guarantees

The orchestrator (the "host") is the only thing that can call a connector, and it enforces:

- `execute` is refused unless `grant.allowedItemIds` contains the item id **and** `grant.planHash` matches the confirmed plan **and** the grant has not expired.
- A connector's content script is registered only for `manifest.origins`. Cross-origin injection is impossible, not merely disallowed.
- Connectors receive a `RunContext` that gives them a logger and a message channel — never the global storage handle, never another connector's data.
- `method: 'dom-automation'` on any capability forces a **visible warning in the UI** ("this step reads the page and may break when the provider changes their design") and forces `strength: 'weak'` on any verification derived from it.

### 4.4 Adding a provider (the checklist that keeps this honest)

1. Write down the provider's *documented* deletion process, with URL and date.
2. Write down the provider's *published* retention statement, verbatim.
3. Decide the method for each capability, preferring documented API > documented UI > DOM.
4. If any capability is `observed-endpoint` (an internal endpoint we noticed but which is not documented), it ships **disabled by default** and is labelled as unsupported and liable to break. See §14.2 for why this is legally and ethically delicate.
5. Test only against a disposable account with synthetic data.

---

## 5. MVP user flow — ChatGPT and Codex

### 5.0 Ground truth about these two providers

| Fact | Status | Source |
|---|---|---|
| A ChatGPT chat is deleted from the sidebar via the ⋯ menu → Delete, with a confirmation | **[VERIFIED]** | OpenAI Help Center |
| Deleted chats are removed from view immediately and scheduled for permanent deletion **within 30 days**, unless already de-identified/disassociated or retained for security or legal obligations | **[VERIFIED]** | OpenAI Help Center |
| Deleted chats are **not recoverable** through UI, API, or support | **[VERIFIED]** | OpenAI Help Center |
| **Archiving is not deleting** — archived chats remain under standard retention | **[VERIFIED]** | OpenAI Help Center |
| Codex chats in the ChatGPT app can be archived or deleted; deletion follows the same "within 30 days" language | **[VERIFIED]** | OpenAI Help Center |
| For Codex chats that used **connected app data**, archiving leaves the connected data stored; **deleting** the conversation is what removes both | **[VERIFIED]** | OpenAI Help Center |
| Settings offers a bulk "delete all chats" control | **[ASSUMPTION]** — believed present; confirm exact wording and blast radius in Week 1 |
| There is a *documented, public, supported* API for deleting a ChatGPT UI conversation | **[ASSUMPTION — believed FALSE]**. The OpenAI Platform API governs API-created resources, not consumer ChatGPT history. **We assume no such public API exists and design for the UI path.** |
| A court preservation order in the NYT litigation once required OpenAI to preserve output log data regardless of user deletion; that broad order has since been terminated | **[VERIFIED, but time-sensitive]** — this is exactly why receipts must never claim erasure |

The last row is the product in a nutshell: for a period, deleting a ChatGPT chat did not mean what users thought it meant, through no fault of OpenAI's, because a court said so. A receipt that says "deleted everywhere" would have been a lie. A receipt that says "we requested deletion on this date, the item is no longer visible, and the provider's stated policy is X" would have remained true.

### 5.1 The flow, screen by screen

**Screen 0 — Install and first run.** One page of plain text: what this does, what it cannot do (§1.5 verbatim), the fact that nothing leaves the machine, and the disposable-account warning during beta. One button: *I understand*.

**Screen 1 — Choose a service.** Two cards: ChatGPT, Codex. Each shows its permission ("this will read chatgpt.com while you use it") and a *Connect* button that requests the optional host permission at that moment — not at install. Each card is independent; connecting one grants nothing to the other.

**Screen 2 — Scan.** The extension opens (or reuses) a provider tab and enumerates conversations. Progress is shown as a count, not a spinner. The user can stop at any point. **Nothing is modified.** Output: a local inventory.

**Screen 3 — Select.** A searchable, filterable list: title, date, project, and where known, an artifact badge ("mentions a GitHub repo", "mentions a deployment URL"). The user selects by search term, date range, or individually. Default selection is **empty**. There is no "select all" without a typed confirmation of the count.

**Screen 4 — Deletion map (preview).** For the selected chats, a panel showing related artifacts, grouped by confidence:
- **Confirmed** — the item is structurally linked (e.g. this Codex task's own chat record).
- **Likely related** — strong signal, e.g. a repository URL appearing in a Codex task the user selected.
- **Needs review** — a URL or path we saw but cannot attribute.

For the MVP, *these are informational only*. Digital Undo will **not** delete a GitHub repo or a deployment in v1. It tells you they exist and links you to the provider's own controls. This keeps the first version's blast radius to "chats we listed."

**Screen 5 — Confirmation.** One screen, no scrolling required to reach the button. It states: the provider, the exact count, the date range, three sample titles, the action (*Delete — permanent, not recoverable*), and the honesty paragraph. The user types the count (e.g. `47`) to enable the button. One click. This is the only destructive gesture in the product.

**Screen 6 — Execution.** Sequential, rate-limited, with a visible per-item log and a working **Stop** button that halts before the next item. Each item: perform the provider's documented delete, wait, re-check, record.

**Screen 7 — Result.** Three counts — *Deleted and verified absent*, *Requested, not verified*, *Unresolved* — and the receipt, with an *Export* button. Unresolved items get a plain-English reason and a suggested next step ("open this chat and check manually", "the page changed while we worked; re-scan").

### 5.2 Rate limiting and good citizenship

Deletion runs are paced deliberately (target: one item every 1.5–3 s, with jitter, and a hard daily cap in the low hundreds). This is not only politeness: a burst of hundreds of rapid delete actions looks like account compromise and may get the user rate-limited or flagged. Slow is a feature. Say so in the UI.

---

## 6. Deletion-map data model

```ts
type Confidence = 'confirmed' | 'likely' | 'needs_review';

type NodeKind =
  | 'chat' | 'project' | 'task'
  | 'repo' | 'commit' | 'branch' | 'pull_request'
  | 'deployment' | 'url'
  | 'local_path' | 'tool_result'
  | 'connected_permission';

interface MapNode {
  id: string;                 // stable local id
  kind: NodeKind;
  provider: string;           // 'chatgpt' | 'codex' | 'github' | ...
  externalId?: string;        // provider's id, if we have one
  label: string;              // shown to user; NEVER copied into a receipt
  labelHash: string;          // salted hash, safe for receipts
  discoveredAt: number;
  firstSeenIn?: string;       // node id of the chat that referenced it
  actionable: boolean;        // can Digital Undo act on it at all?
  actionOwner: 'digital_undo' | 'user_via_provider' | 'not_actionable';
}

interface MapEdge {
  from: string;               // MapNode.id
  to: string;
  relation:
    | 'created_by'            // this deployment was created by that task
    | 'referenced_in'         // this repo URL appeared in that chat
    | 'same_session'
    | 'same_project'
    | 'derived_from';
  confidence: Confidence;
  /** Why we believe this. Must be a fixed enum, not free text from content. */
  basis: 'provider_structural_link' | 'explicit_url_match' | 'id_match'
       | 'timestamp_proximity' | 'name_similarity' | 'user_asserted';
  observedAt: number;
}

interface DeletionMap {
  runId: string;
  nodes: MapNode[];
  edges: MapEdge[];
}
```

### 6.1 Confidence rules (deterministic, not vibes)

- **Confirmed** — the provider itself asserts the link through structured data. Example: a Codex task record that contains the task's own conversation id. Only `provider_structural_link` and `id_match` can produce *confirmed*.
- **Likely related** — a strong, unambiguous signal that is nonetheless inference. Example: a full `github.com/org/repo` URL appearing inside a selected Codex task, where the account has push access to that repo. Basis: `explicit_url_match`.
- **Needs review** — anything else: timestamp proximity, name similarity, a bare path string, a URL we cannot attribute to the user's own accounts.

**No edge is ever auto-promoted.** A user can promote an edge to *confirmed* manually; that records basis `user_asserted`, which is honest and distinguishable in the receipt.

**Nothing in `needs_review` is ever acted upon automatically, in any version, ever.**

---

## 7. Deletion-receipt format

### 7.1 Design goal

Prove the *process*, never re-record the *content*. A receipt should be something a user can hand to an employer, a client, or a regulator without leaking a single sentence of what was in the chats.

### 7.2 Schema

```jsonc
{
  "schema": "digital-undo.receipt.v1",
  "receiptId": "r_2026-09-03T14-22-11Z_9f3a",
  "runId": "run_01J...",
  "app": { "name": "Digital Undo", "version": "0.1.0", "buildHash": "sha256:..." },
  "provider": {
    "id": "chatgpt",
    "displayName": "ChatGPT",
    "connectorVersion": "0.1.0",
    "method": "documented-ui"
  },
  "scope": {
    "approvedAt": "2026-09-03T14:20:02Z",
    "approvedBy": "local_user_gesture",
    "planHash": "sha256:...",              // ties receipt to the exact previewed plan
    "itemCount": 47,
    "selectionCriteria": "manual_selection", // or "search_term_hash", "date_range"
    "dateRange": { "from": "2025-01-01", "to": "2026-08-30" }
  },
  "items": [
    {
      "itemRef": "chatgpt:conv:6f1c…a09",    // provider id, truncated
      "titleHash": "sha256:salt:…",          // salted; NOT reversible, NOT the title
      "itemType": "chat",
      "requestedAction": "delete",
      "requestedAt": "2026-09-03T14:20:09Z",
      "observedResult": "absent_from_list",
      "observedAt": "2026-09-03T14:20:13Z",
      "evidenceStrength": "moderate",
      "evidence": [
        { "kind": "ui_confirmation_observed", "at": "2026-09-03T14:20:10Z" },
        { "kind": "absent_after_reload", "at": "2026-09-03T14:20:13Z" }
      ]
    }
  ],
  "summary": {
    "requested": 47,
    "observedAbsent": 45,
    "stillPresent": 0,
    "unresolved": 2
  },
  "unresolved": [
    {
      "itemRef": "chatgpt:conv:1ab…77c",
      "reason": "page_state_unexpected",
      "suggestedNextStep": "open_item_manually",
      "lastObservedAt": "2026-09-03T14:21:44Z"
    }
  ],
  "providerRetentionDisclaimer": {
    "text": "Deleted chats are removed from your view immediately and are scheduled for permanent deletion within 30 days, unless already de-identified and disassociated from your account, or retained for security or legal obligations.",
    "sourceUrl": "https://help.openai.com/en/articles/8809935-how-to-delete-and-archive-chats-in-chatgpt",
    "verifiedOn": "2026-09-03"
  },
  "limitations": [
    "This records a deletion request and an observation, not confirmed erasure.",
    "Provider backups, legal holds, and security retention are outside our visibility.",
    "Copies, exports, forks, screenshots, and other accounts are unaffected.",
    "Content that influenced a trained model cannot be removed from that model.",
    "Verification reflects what was visible to this browser session at the time shown."
  ],
  "integrity": {
    "receiptHash": "sha256:...",
    "signedBy": "local_device_key",         // keypair generated on device, never uploaded
    "signature": "..."
  }
}
```

### 7.3 Notes on the deliberate choices

- **`titleHash`, not `title`.** Salted per install. The user can verify a title matches by re-hashing it in the app; a reader of the receipt learns nothing. The salt is stored locally and is *not* in the receipt.
- **`evidenceStrength` is a closed enum**: `strong` (provider returned a machine-readable success for a documented delete endpoint), `moderate` (documented UI action completed *and* item absent after reload), `weak` (item merely absent from a rendered list, no confirmation observed).
- **`observedResult` never says "deleted".** It says what we saw: `absent_from_list`, `still_present`, `inaccessible`, `indeterminate`.
- **`signedBy: local_device_key`** proves the receipt was not edited after the fact *by someone other than the receipt holder*. It does **not** prove the deletion happened — the user controls the key. We must say this in the UI, because a receipt that oversells its own cryptography is the same lie in a different coat. Third-party-verifiable receipts would require a trusted timestamping service and are a Phase 3 question (§17.9).
- **Export formats**: JSON (canonical) and a rendered PDF/HTML for humans, generated locally.

---

## 8. Permissions and how to minimise them

### 8.1 MVP manifest (target)

```jsonc
{
  "manifest_version": 3,
  "name": "Digital Undo",
  "permissions": ["storage", "sidePanel", "scripting"],
  "optional_host_permissions": [
    "https://chatgpt.com/*"
  ],
  "host_permissions": [],
  "content_scripts": [],          // registered dynamically, per granted origin
  "background": { "service_worker": "sw.js", "type": "module" }
}
```

### 8.2 The minimisation rules

| Rule | Effect |
|---|---|
| **No host permission at install.** All provider origins go in `optional_host_permissions` and are requested at the moment the user clicks *Connect* to that provider **[VERIFIED as the recommended pattern]** | Install shows no scary warning; the user grants ChatGPT access without ever granting Claude access. |
| **Dynamic content-script registration** via `chrome.scripting.registerContentScripts`, scoped to granted origins only | A connector physically cannot run on an origin the user has not connected. |
| **No `tabs` permission** if avoidable | We can work with `activeTab`-style flows and our own created tabs. Confirm during spike. **[ASSUMPTION]** |
| **No `cookies` permission. Ever.** | We never read session tokens. This should be a stated selling point. |
| **No `downloads` permission** — exports go through a user-initiated save | One less capability. |
| **No `webRequest`/`declarativeNetRequest`** | We do not intercept traffic. |
| **Revocation is one click** and *revoking a provider deletes that provider's inventory* (receipts survive, since they contain no content). | Permission and data lifetime are tied. |

### 8.3 Chrome Web Store policy alignment

- **Single purpose:** "help a user delete their own AI chat data and produce a record of it." Every permission maps to it. Chrome's 2026 policy update requires that collected data be *strictly necessary* to the disclosed single purpose, with enforcement from 1 August 2026 **[VERIFIED]** — we are well inside this, because we collect nothing.
- **Prominent disclosure:** the store listing, the first-run screen, and the privacy policy must all say the same thing. Chrome's updated transparency standard requires disclosure of all data collection regardless of relatedness **[VERIFIED]**.
- **No remote code** **[VERIFIED]** — already a design constraint (§2.3).
- **Risk to flag now:** an extension that deletes user data at scale in a third-party product may attract manual review, and reviewers may ask hard questions about automation of another company's site. Budget for a slow first review and write the reviewer notes carefully. **[ASSUMPTION about reviewer behaviour — plan for it, don't panic about it.]**

---

## 9. What can be verified technically vs. what needs the provider's word

This section is the intellectual core of the product. Get it wrong and the receipt is worthless.

| Claim | Can we verify? | How | Strength |
|---|---|---|---|
| "The item is no longer in your list" | **Yes** | Re-fetch/re-render the list after the action; item absent | Moderate |
| "The item's URL no longer loads for you" | **Yes** | Navigate to the item URL; observe 404/redirect/not-found state | Moderate |
| "The provider's UI confirmed the action" | **Yes** | Observe the confirmation state the provider shows | Moderate |
| "The delete request returned success" | **Sometimes** | Only if a documented endpoint returns a machine-readable result | Strong |
| "It is gone from the provider's live database" | **No** | We have no view into their systems | — |
| "It is gone from backups" | **No** | Backups are invisible to users by definition | — |
| "It will be gone within 30 days" | **No — provider's stated policy only** | Quote OpenAI's published statement verbatim, with URL and date **[VERIFIED]** | Provider assertion |
| "It was not retained for legal/security reasons" | **No** | Providers explicitly reserve this; the NYT preservation order is the proof that it happens **[VERIFIED]** | — |
| "It did not influence a trained model" | **No, and never will be** | — | — |
| "No copies exist elsewhere" | **No** | Forks, exports, screenshots, other accounts | — |
| "Connected-app data referenced in a Codex chat was removed" | **Partly** | OpenAI states that *deleting* (not archiving) the conversation is what removes connected app data **[VERIFIED]**; we can verify the chat is gone, not the connected data | Provider assertion |

**The rule this produces:** every receipt line is either *our observation* (timestamped, strength-rated, honest about being a browser-side view) or *the provider's published statement* (quoted, sourced, dated). There is no third category, and nothing in the product ever synthesises the two into "erased."

A useful phrase for the UI: **"We can prove we asked, and we can show you what we saw. Only the provider can speak to what happens next."**

---

## 10. Failure handling, recovery, partial success, auditability

### 10.1 Run state machine

`idle → scanning → planned → confirmed → executing → verifying → completed | halted | failed`

Every transition is written to IndexedDB before it takes effect. A service-worker restart mid-run resumes from the last committed step and re-verifies the item that was in flight before doing anything new.

### 10.2 Failure taxonomy and response

| Failure | Response |
|---|---|
| Not signed in / session expired | Halt the run, tell the user, resume after they sign in. Never attempt re-auth ourselves. |
| Provider UI changed (selector miss) | Halt **the whole run**, not just the item. A changed UI means our model of the page is wrong and every subsequent action is unsafe. Emit a distinctive error the user can report. |
| Rate limited / 429 | Exponential backoff, then halt with a resumable state. |
| Item already gone | Record `skipped`, evidence `already_absent`. Not a failure. |
| Action performed, verification inconclusive | `unresolved`, strength `weak`, with a "check manually" link. Never upgraded to success. |
| Network drop mid-run | Pause, retry the *verification* only. Never blind-retry a destructive action — a retry can hit a different item if the list reflowed. |
| Plan drift (list changed since preview) | Halt, re-scan, re-preview, re-confirm. No exceptions. |
| Unknown error | Halt. Fail closed. |

**Recovery is not undo.** We must say this loudly: deletions at these providers are not recoverable (**[VERIFIED]** for ChatGPT). "Digital Undo" undoes your *digital footprint*, it does not undo deletions. Consider whether the name creates a false expectation — see §17.10.

### 10.3 Partial success

A run of 100 items that deletes 93, skips 4 as already gone, and leaves 3 unresolved is a **normal, honest outcome** — not a failure. The UI presents it that way, the receipt records all four categories, and the summary counts always reconcile: `requested == observedAbsent + stillPresent + unresolved + skipped`. A receipt whose counts do not reconcile is a bug and should fail schema validation.

### 10.4 Auditability

- **Local run log**: append-only, structured, per-run, with the same no-content rules as receipts. Retained until the user clears it.
- **Receipt chain**: each receipt includes the previous receipt's hash for that install, so a missing receipt is detectable.
- **Deterministic replay**: given a plan and a log, the sequence of intended actions can be re-derived and reviewed.
- **No silent actions**: any action performed without a corresponding log line is a P0 bug class, tested for.

---

## 11. One-week disposable-account feasibility test

**Purpose:** find out whether the honest version of this product is technically possible, *before* spending real money. Cost target: under $100 (two ChatGPT subscriptions if needed) and one developer-week.

**Rules for the whole week:** disposable accounts only, created for this test, with synthetic conversations only. No personal accounts. No real client data. No other person's data. Nothing gets deleted that anyone would miss.

| Day | Goal | Deliverable | Kill signal |
|---|---|---|---|
| **1** | Ground truth. Read and screenshot every relevant OpenAI help/policy page. Build the fact table from §5.0 with dates and quotes. | `docs/provider-facts/openai.md` | A documented restriction that forbids the whole approach |
| **2** | Populate. Create 2 disposable accounts. Generate ~120 synthetic chats and ~10 Codex tasks with recognisable marker strings. | Reproducible seeding script | Cannot create enough volume to test paging |
| **3** | Read-only scan. Enumerate all conversations reliably, including paging. Measure: completeness, time, breakage. | Working scan spike; a `Plan` JSON | Cannot enumerate reliably or completely |
| **4** | Single delete + verify. Delete exactly one chat via the documented UI path; verify absence three ways (list, reload, direct URL). | Verification matrix with observed strengths | No verification signal is reliable |
| **5** | Batch of 25. Sequential, rate-limited, with stop, resume after forced service-worker kill, and partial-success handling. | Run log + first real receipt | Unacceptable breakage rate (>10% unresolved) |
| **6** | Codex specifics. Repeat 3–5 for Codex chats. Probe artifact discovery: can we see repo/deployment references at all, and with what confidence? | Codex facts + a sample deletion map | Codex surface is not enumerable |
| **7** | Write up. Compare against §12 acceptance criteria. Recommend go / narrow / stop. | 3-page memo | — |

**What we will *not* do during the test:** no reverse-engineering of internal endpoints for production use (observation for understanding is fine; shipping on them is not — §14.2), no testing against anyone else's account, no scraping of content into any file we keep.

---

## 12. Acceptance criteria for "is this viable?"

Go if **all** of these hold after Week 1:

1. **Enumeration** — we can list ≥99% of conversations in a 100+ chat disposable account, twice in a row, with the same result.
2. **Deletion** — the documented deletion path can be driven for ≥95% of selected items in a 25-item batch, with zero items deleted that were not in the confirmed plan (**this one must be 100%; any breach is an automatic stop**).
3. **Verification** — at least one verification signal is reliable enough to justify `moderate` strength on ≥95% of successfully deleted items.
4. **Stability** — the flow survives a forced service-worker termination and resumes without duplicate or skipped actions.
5. **Privacy invariants** — I1–I5 (§3.3) all pass automated tests on the spike.
6. **Receipt** — a schema-valid receipt is produced whose counts reconcile and which contains no marker string from the synthetic content.
7. **Honesty** — a non-technical reader shown the receipt correctly answers "does this prove the data is gone?" with "no — it proves a request and an observation." *Test this with three actual humans.*
8. **Policy** — nothing found in provider terms or Chrome Web Store policy that forbids a user-driven, own-account cleanup tool. (If uncertain, this becomes a one-hour legal question, not a guess.)

**Narrow instead of stopping** if 1–6 pass but the *Codex* surface is unworkable: ship ChatGPT-only.

**Stop** if enumeration or deletion is unreliable, or if verification is so weak that the receipt says nothing more than "we clicked a button." A receipt with no evidentiary value is not a product.

---

## 13. Phased roadmap

| Phase | Scope | Why this order | Main new risk |
|---|---|---|---|
| **0 — Feasibility** (1 week) | §11 | Cheapest possible truth | — |
| **1 — MVP** (4–6 weeks) | ChatGPT + Codex; scan, preview, confirm, delete, verify, receipt; zero egress | Proves the promise end-to-end on one provider family | Provider UI change breaking the connector |
| **2 — Claude + Grok** (3–4 weeks) | Two more isolated connectors, same interface, same honesty | Both publish comparable 30-day deletion policies **[VERIFIED]**, so the receipt model transfers cleanly | Connector sprawl; each new provider is permanent maintenance |
| **3 — GitHub tracing (read-only)** (3 weeks) | A GitHub connector that *reads* to build the deletion map: repos, commits, branches, PRs touched by AI tasks. **No deletion.** Prefer a GitHub App with fine-grained permissions over an OAuth app's broad `repo` scope **[VERIFIED as GitHub's own recommendation]** | Tracing is the differentiator; deleting repos is the liability | Scope creep toward destructive GitHub actions |
| **4 — Deployments (read-only)** (3 weeks) | Recognise deployment URLs and, where the user connects a host, list matching deployments. Still no deletion — deep-link to the provider's own delete control | Same reasoning as Phase 3 | Every host is a separate integration |
| **5 — Local-file tracing** (4+ weeks) | Optional native-messaging helper or a separate desktop app that indexes user-nominated folders for artifacts, entirely locally | Highest privacy sensitivity, highest platform friction; must be last | Native host = new attack surface, code signing, per-OS work |
| **6 — Assisted DSAR** (TBD) | Generate a pre-filled data-subject request for the user to send themselves, using the receipt as an attachment | Reaches the parts automation cannot | Legal representation risk — must remain "we help you write it" |

**Destructive actions outside chat deletion stay off the table until at least Phase 5**, and each one needs its own confirmation design, its own threat model, and its own dry-run mode.

---

## 14. Risks

### 14.1 Technical

| Risk | Severity | Mitigation |
|---|---|---|
| Provider UI changes break connectors | **High, and certain to happen** | Halt-on-mismatch; fast release process; a "connector health" self-test the user can run; public status page |
| MV3 no-remote-code means every fix needs store review | High | Keep connectors small; batch releases; consider a "safe mode" that degrades to guided manual deletion |
| Service-worker termination mid-run | Medium | Persist every step; resume-and-reverify |
| Verification is weaker than users expect | Medium | Never overstate strength; UI language does the heavy lifting |
| DOM automation fragility generally | **High — flag prominently** | Every DOM-dependent capability is labelled `dom-automation` in the connector manifest and surfaced to the user as fragile |

### 14.2 Legal

| Risk | Severity | Notes |
|---|---|---|
| Provider terms restricting automated access to their services | **High — must be checked properly** | A user deleting their own data through their own browser is a sympathetic case, but sympathy is not a licence. Get a lawyer to read OpenAI's terms specifically on automation/scraping before launch. **[UNRESOLVED — see §17.1]** |
| Building on undocumented internal endpoints | High | Even where technically easy, this is where terms-of-service and CFAA-adjacent arguments live, and it breaks without notice. Default: don't. If ever used, disabled by default and disclosed. |
| Receipts being read as legal proof | Medium | Explicit disclaimer in every receipt; never market as compliance evidence |
| Marketing overclaim | **High — self-inflicted** | The honesty paragraph (§1.5) is a product requirement, not copy. Put it under change control. |
| GDPR/CCPA positioning | Medium | We help users exercise rights; we are not a processor of their chat data because we never receive it. Confirm with counsel that zero-egress design keeps us out of processor status. |

### 14.3 Security

| Risk | Severity | Mitigation |
|---|---|---|
| Extension supply chain (a dependency ships malware) | **High** | Minimal dependencies, pinned, vendored where sensible, `npm ci` with lockfile audit in CI |
| Our own release keys compromised | High | Two-person release, hardware keys, published build hashes |
| Over-broad permissions later added quietly | High | Permissions diff is part of every release review and changelog |
| Receipt store leaking on a shared machine | Medium | Optional passphrase encryption; easy purge |
| Hostile provider page manipulating the run | Medium | Confirmed-id-list cap; page data treated as untrusted |

### 14.4 Platform policy

| Risk | Severity | Mitigation |
|---|---|---|
| Chrome Web Store rejects or delays review | Medium–High | Impeccable single-purpose story; no collection; clear reviewer notes; expect a slow first review |
| Chrome's Aug 2026 limited-use enforcement | Medium | We collect nothing, so compliance is straightforward — but the *disclosure* obligations still apply **[VERIFIED]** |
| A provider asks the store to remove us | Medium | Be scrupulously user-initiated, rate-limited, own-account-only; keep a documented good-faith record; have a response plan |
| Firefox/Safari divergence later | Low (for now) | Keep connector code browser-agnostic; isolate WebExtension API use behind a thin adapter |

---

## 15. Technology, structure, testing

### 15.1 Stack

- **TypeScript**, strict mode, no `any` in connector or receipt code.
- **Vite + `@crxjs/vite-plugin`** (or an equivalent MV3 bundler) — chosen for fast HMR on extension work.
- **Preact or React** for the side panel. Small. No UI framework that pulls a large dependency tree.
- **IndexedDB via `idb`** — small, well understood.
- **Zod** for runtime schema validation of plans and receipts (the receipt schema must be enforced at write time, not just at type time).
- **Vitest** for unit tests, **Playwright** for extension-level integration tests against a local fixture site.
- **No analytics library. No error reporting SDK. No remote config.** These are the three most common ways a zero-egress promise dies.

### 15.2 Structure

```
digital-undo/
├── src/
│   ├── background/          # orchestrator: run state machine, scope grants, receipts
│   ├── ui/                  # side panel + options
│   ├── core/
│   │   ├── plan.ts          # Plan, hashing, drift detection
│   │   ├── receipt.ts       # schema + writer + signing
│   │   ├── map.ts           # DeletionMap, confidence rules
│   │   └── store.ts         # IndexedDB, no-content invariants
│   ├── connectors/
│   │   ├── types.ts         # THE interface (§4). Nothing else may define it.
│   │   ├── chatgpt/         # manifest, scan, execute, verify, selectors
│   │   └── codex/
│   └── shared/
├── fixtures/                # offline HTML fixtures mimicking provider pages
├── tests/
│   ├── unit/
│   ├── invariants/          # I1–I5 from §3.3
│   └── e2e/                 # Playwright against fixtures, never against live providers
└── docs/
    ├── provider-facts/      # dated, sourced, screenshotted ground truth
    └── threat-model.md
```

### 15.3 Testing strategy

1. **Fixture-first.** The e2e suite runs against local HTML fixtures captured from provider pages, so CI never touches a real provider. Fixtures are refreshed deliberately, and a fixture refresh that breaks a connector is exactly the signal we want.
2. **Invariant tests are first-class** (§3.3) and gate every release.
3. **Marker-string tests.** Synthetic content contains unique markers; a test greps the entire local store, every log, and every receipt for those markers. Any hit is a release blocker.
4. **Destructive-action tests never run against a live account in CI.** Live testing is manual, on disposable accounts, with a written checklist.
5. **Plan-immutability property tests** — random mutations of a confirmed plan must always be rejected.
6. **Reconciliation test** — every generated receipt's counts must reconcile (§10.3).
7. **A "does it lie?" review** on every release: one person reads all user-facing strings against §1.5 and §9 and signs off.

---

## 16. Prioritised backlog

### Must have (v1 does not ship without these)

1. Provider-facts document with dated sources for ChatGPT and Codex
2. Connector interface + host-enforced scope grants (§4)
3. ChatGPT connector: scan, delete (documented UI path), verify
4. Codex connector: scan, delete, verify
5. Plan + hash + drift detection + immutability
6. Selection UI with empty default and typed-count confirmation
7. Sequential rate-limited executor with working Stop and resume
8. Receipt v1: schema, validation, local signing, JSON + human export
9. Partial-success reporting and the unresolved list
10. Honesty copy in first-run, confirmation, and receipt
11. Optional host permissions requested at connect time; one-click revoke
12. Invariant tests I1–I5 and marker-string tests
13. Local run log with append-only semantics
14. Purge-all-local-data control

### Should have (v1.1)

15. Deletion map, read-only, for artifacts visible inside chats (§6)
16. Search/date-range selection and saved filters
17. Connector health self-test ("is our model of the page still right?")
18. Receipt chain hashing
19. Passphrase encryption for the receipt store
20. Provider retention disclaimers auto-refreshed from a *locally bundled*, versioned facts file
21. Guided manual mode: when a connector breaks, walk the user through the provider's own UI and still produce a receipt
22. Archive-vs-delete education (important for Codex connected-app data **[VERIFIED]**)

### Later

23. Claude and Grok connectors
24. GitHub read-only tracing with a fine-grained GitHub App
25. Deployment tracing
26. Local-file tracing via a native helper
27. Assisted DSAR generation
28. Third-party-verifiable receipt timestamping
29. Firefox / Safari ports
30. Team or enterprise mode (a genuinely different product; do not let it leak into v1)

---

## 17. The ten most important unanswered questions

1. **Do OpenAI's terms of service permit a user-driven browser extension to automate deletion in their own account?** This is the single question that can end the project. It needs a lawyer, not a forum post. *Owner: founder + counsel. Before Phase 1.*
2. **Is there any documented, supported interface for deleting ChatGPT/Codex conversations, or is the UI genuinely the only path?** We currently assume UI-only. If true, the entire product rests on DOM automation, which is fragile by definition, and that materially changes the risk profile and the maintenance cost. *Owner: dev, Day 1.*
3. **How strong can verification actually get?** If the best we can honestly say is "it disappeared from a list," is that enough for anyone to pay for? *Owner: dev + 3 user interviews, Week 1.*
4. **Will users accept an honest receipt?** The market may want "erased everywhere." We will not say it. Is there a real market for the truthful version? *Owner: founder. This is the business question.*
5. **What is the real breakage cadence of ChatGPT's UI?** If the connector breaks monthly and each fix needs a store review, what does support cost, and can the guided-manual fallback carry the product between releases?
6. **How much of the artifact-tracing vision is achievable without granting broad permissions?** GitHub read access is already a meaningful permission; deployments more so. Where is the line users actually accept?
7. **What happens to the zero-egress promise when we need money?** Licensing, updates, and support all pull toward a server. Decide the monetisation model *now*, while it is still cheap to keep the promise.
8. **Does a bulk "delete all" provider control make most of our value redundant?** If a user can clear everything in two clicks in settings, our value is selectivity, tracing, and the receipt — not deletion. Confirm what the provider already offers before building.
9. **Should receipts be third-party verifiable?** A self-signed receipt proves integrity to its holder only. Trusted timestamping would make it stronger, but requires a network service — directly against §2.2b. Genuine tension; decide deliberately.
10. **Is "Digital Undo" the right name?** It implies reversibility, and the product's core honest message is that deletion is *not* reversible and *not* provably complete. A name that promises undo may undermine the trust the receipt is meant to build.

---

## Sources

Provider and platform facts referenced above:

- OpenAI Help Center — *How to Delete and Archive Chats in ChatGPT*: https://help.openai.com/en/articles/8809935-how-to-delete-and-archive-chats-in-chatgpt
- OpenAI Help Center — *Chat and File Retention Policies in ChatGPT*: https://help.openai.com/en/articles/8983778-chat-and-file-retention-policies-in-chatgpt
- OpenAI Help Center — *How to archive and delete Codex chats in the ChatGPT app*: https://help.openai.com/en/articles/20001333-how-to-archive-and-delete-codex-chats-in-the-chatgpt-app
- OpenAI Help Center — *Data Controls FAQ*: https://help.openai.com/en/articles/7730893-data-controls-faq
- OpenAI — *Privacy policy* and privacy request portal: https://openai.com/policies/privacy-policy/ , https://privacy.openai.com/
- Reporting on the NYT-litigation preservation order and its termination (multiple secondary sources; verify current status before relying on it)
- Chrome for Developers — *Limited Use*: https://developer.chrome.com/docs/webstore/program-policies/limited-use
- Chrome for Developers — *Chrome Web Store policy updates (2026)*: https://developer.chrome.com/blog/cws-policy-updates-2026
- Chrome for Developers — *Additional Requirements for Manifest V3*: https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements
- Chrome for Developers — *Declare permissions*: https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
- Chrome for Developers — *What is Manifest V3* (no remotely hosted code): https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3
- Anthropic Privacy Center — *Can you delete data sent via Claude?*: https://privacy.anthropic.com/en/articles/7996878-can-you-delete-data-sent-via-claude-ai
- Anthropic — *Updates to Consumer Terms and Privacy Policy*: https://www.anthropic.com/news/updates-to-our-consumer-terms
- xAI — *Privacy Policy*: https://x.ai/legal/privacy-policy
- GitHub Docs — *Scopes for OAuth apps*: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
- GitHub Docs — *Deciding when to build a GitHub App* (fine-grained permissions): https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/deciding-when-to-build-a-github-app

**Re-verify every provider fact, with a screenshot and a date, before it appears in shipped copy.**
