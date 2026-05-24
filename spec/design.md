# Triangulation — Architecture and Design

| Field | Value |
|---|---|
| **Companion to** | `triangulation_functional_spec.md` (v1.0) |
| **Application version** | 4.1 |
| **Document type** | Architecture / Design |
| **Source artifact** | `triagulation-html/triangulation_v4_1.html` |
| **Date** | 2026-05-23 |

This document describes *how* Triangulation is built. The functional
specification describes *what* it does and *why*; this document describes
the internal structure, the component boundaries, the data shapes that
move across them, and the rationale behind the implementation choices
made in v4.1.

---

## 1. Architectural Overview

### 1.1 Deployment Shape

Triangulation is a **single static HTML file** with embedded CSS and
JavaScript. There is no build pipeline, bundler, transpiler, server, or
external runtime framework. The only network calls the file makes after
load are:

- One web font request to `fonts.googleapis.com` (presentational only).
- LLM API calls to the three provider endpoints, made on demand from
  user interaction.

This shape is a load-bearing design decision, not an accident of scope.
The application is meant to be openable from a `file://` URL on any
modern browser, audited in a single read, modified without tooling, and
preserved alongside its prior versions as a forensic trail of how the
instrument evolved. Every architectural choice downstream is conditioned
on this constraint.

### 1.2 Execution Model

The application is a **client-side orchestrator** of three external LLM
APIs. The browser drives the workflow; it is responsible for:

1. Storing provider credentials in `localStorage`.
2. Issuing parallel HTTPS requests to each provider.
3. Composing the judging and synthesis prompts.
4. Parsing provider responses.
5. Rendering markdown and annotation tags into DOM.
6. Maintaining UI state across three tabs.

There is no intermediary. Credentials, prompts, and responses move
directly between the user's browser and each provider's API. This is the
property the security banner warns about (§10 of the functional spec)
and is unavoidable given the single-file constraint.

### 1.3 Top-Level Component View

```
                       ┌──────────────────────────────────┐
                       │   triangulation_v4_1.html        │
                       │                                  │
                       │   ┌───────────────────────────┐  │
                       │   │  Presentation Layer       │  │
                       │   │  (HTML + CSS, three tabs) │  │
                       │   └─────────────┬─────────────┘  │
                       │                 │                │
                       │   ┌─────────────┴─────────────┐  │
                       │   │  Orchestrator             │  │
                       │   │  sendPrompt()             │  │
                       │   │  fireSource() x3          │  │
                       │   │  fireJudge() x6           │  │
                       │   │  fireSynthesis()          │  │
                       │   └─────────────┬─────────────┘  │
                       │                 │                │
                       │   ┌─────┬───────┴───────┬─────┐  │
                       │   │ API │ Run State     │ UI  │  │
                       │   │ Cli │ runState{}    │ Set │  │
                       │   └──┬──┴───────────────┴──┬──┘  │
                       │      │                     │     │
                       │   ┌──┴─────┐         ┌─────┴──┐  │
                       │   │ Config │         │ MD     │  │
                       │   │ store  │         │ render │  │
                       │   └────────┘         └────────┘  │
                       └──────┬───────────────────────────┘
                              │
              ┌───────────────┼────────────────┐
              ▼               ▼                ▼
         api.anthropic   api.openai      generativelanguage
            .com           .com          .googleapis.com
```

All modules live in one file; the boundaries above are *logical*
groupings of functions and styles, not file or module boundaries.

---

## 2. Module Layout (Logical Sections of the File)

The script tag contains the entirety of the application logic. Within
it, code is organized into the following logical sections, in the order
they appear in the file:

| Section | Responsibility | Key Symbols |
|---|---|---|
| **Constants & state** | Storage keys, provider list, token budgets, the singleton `runState` object | `STORAGE_KEY`, `LEGACY_KEYS`, `PROVIDERS`, `DISPLAY`, `TOKEN_BUDGETS`, `SYNTHESIS_MAX_TOKENS`, `runState` |
| **Config store** | Load / save / clear configuration in `localStorage` with legacy-version fallback | `loadConfig()`, `saveConfig()`, `clearKeys()`, `updateModelLabels()`, `getCfg()` |
| **Tab control** | Switch active tab, dismiss the Truth Be Told pulse on focus | `showTab()` |
| **Panel UI setters** | Mutate per-provider response panel state | `setPanel()` |
| **Verdict UI setters** | Mutate the dual rendering (badge + pill + explanation box) of a single source-judge pair | `setVerdict()`, `scoreClass()` |
| **Synthesis UI setters** | Mutate the synthesis status row, metadata strip, and body | `setSynthesisStatus()`, `setSynthesisMeta()`, `setSynthesisBody()` |
| **Markdown renderer** | Inline subset markdown → HTML, with HTML escaping; specialized variant preserves `<spin>`/`<dispute>` tags | `escapeHTML()`, `renderMarkdown()`, `renderSynthesisMarkdown()` |
| **API clients** | One async function per provider, plus the `EmptyResponseError` class and the `PROVIDER_CALL` dispatch table | `callAnthropic()`, `callOpenAI()`, `callGoogle()`, `PROVIDER_CALL`, `EmptyResponseError` |
| **Judge logic** | Compose judge prompts; parse score+explanation back out; fire one judge call | `buildJudgePrompt()`, `parseJudgeReply()`, `fireJudge()` |
| **Synthesis logic** | Compose the synthesis prompt from the populated `runState`; compute stats; fire the synthesis call | `buildSynthesisPrompt()`, `computeSynthesisStats()`, `fireSynthesis()` |
| **Orchestrator** | Validate input, reset state, drive the source→judge→synthesis pipeline; reset helpers | `resetRunState()`, `clearResponses()`, `fireSource()`, `sendPrompt()` |
| **Boot** | Attach keyboard handler, model-label input listeners, load saved config | (top-level statements at end of script) |

There are no classes other than `EmptyResponseError`. All state lives
either in the DOM or in the singleton `runState` object.

---

## 3. Data Model

### 3.1 Persistent Configuration

Stored in `localStorage` under `triangulation_v4_1_config` as a JSON
object:

```ts
type PersistedConfig = {
  anthropicKey:   string;   // plaintext API key
  openaiKey:      string;
  googleKey:      string;
  anthropicModel: string;   // model identifier (e.g. "claude-opus-4-7")
  openaiModel:    string;
  googleModel:    string;
};
```

**Legacy fallback.** On first load, `loadConfig()` looks under the
current key first; if absent, it tries each prior version's key in
order: `v4`, `v3.1`, `v3`, `v2`, `v1`. This provides forward-migration
of stored credentials when a user opens a newer version of the HTML
file alongside an older one in the same browser profile, without
requiring explicit migration logic — the schema has been stable across
versions, so a literal read of the older payload is sufficient.

**Plaintext storage** is acceptable only because the app is intended for
single-user local experimentation. See §10 of the functional spec.

### 3.2 In-Memory Run State

A single module-scoped object captures everything the synthesis call
needs to know. It is *not* persisted; each prompt submission resets it.

```ts
type RunState = {
  prompt: string;
  responses: {
    anthropic: string | null;
    openai:    string | null;
    google:    string | null;
  };
  judgments: {
    // Six total keys, formed as `${source}-${judge}`:
    [key: `${Provider}-${Provider}`]:
      { score: number; explanation: string }
  };
};
```

**Key convention.** `judgments['anthropic-openai']` means *OpenAI's
judgment of Anthropic's response*. The `source-judge` ordering is
consistent across DOM element IDs (`verdict-anthropic-openai`,
`pill-anthropic-openai`, `explain-anthropic-openai`) and the synthesis
prompt builder.

**Completeness contract.** The synthesizer reads `runState` *after*
`Promise.allSettled` on all source jobs returns. At that point any
successful source produces a non-null entry in `responses`, and any
successfully scored judge call produces an entry in `judgments`.
Missing entries are not errors — they are explicit "not produced"
signals that `buildSynthesisPrompt()` formats into the prompt.

### 3.3 DOM as State Store

A deliberate decision: visible state is read off the DOM rather than
mirrored into JavaScript variables. There is no virtual DOM, no
framework state. UI mutations are performed by id-keyed setters
(`setPanel`, `setVerdict`, `setSynthesisStatus`, `setSynthesisBody`)
that toggle classes and write `textContent` or `innerHTML`.

The two stateful places outside the DOM are:

1. `runState` (synthesis input bundle).
2. `localStorage` (persisted config).

This keeps the data model knowable in one screenful.

---

## 4. Orchestration

### 4.1 Pipeline Shape

`sendPrompt()` is the single entry point for the workflow. It runs the
three phases in sequence, with maximum parallelism within each phase.

```
sendPrompt()
  ├─ validate prompt + at-least-one-key
  ├─ resetRunState(prompt) + UI reset
  ├─ disable Send button
  │
  ├─ Phase 1+2 (interleaved, per-source):
  │     PROVIDERS.map(async source =>
  │         fireSource(source) → if success →
  │             Promise.allSettled(judges.map(fireJudge))
  │     )
  │     awaited with Promise.allSettled
  │
  ├─ Phase 3:
  │     fireSynthesis(cfg)
  │
  └─ re-enable Send button
```

Three observations about the shape:

- **Source calls do not wait for each other.** Each provider's source
  call runs concurrently with the other two.
- **Judge calls do not wait for cross-source completion.** As soon as
  any single source response arrives, that source's two judge calls
  fire immediately, in parallel with whatever else is still in flight.
  An OpenAI judgment of an Anthropic response can complete before the
  Google source call has even started.
- **Synthesis is fully gated.** It cannot begin until every source and
  every judge call has settled (`Promise.allSettled` resolves on both
  fulfilled and rejected promises). This is necessary because the
  synthesis prompt requires the complete bundle to function.

### 4.2 Sequence Diagram (Happy Path)

```
User    sendPrompt   fireSource(A)   fireSource(O)   fireSource(G)   judges  synthesis
 │         │             │                │                │             │       │
 │ submit  │             │                │                │             │       │
 ├────────▶│             │                │                │             │       │
 │         │ resetState  │                │                │             │       │
 │         ├─────────────┤                │                │             │       │
 │         │ start 3 sources in parallel                                 │       │
 │         ├────────────▶│                │                │             │       │
 │         ├────────────────────────────▶│                │             │       │
 │         ├────────────────────────────────────────────▶│             │       │
 │         │             │ ←api──         │                │             │       │
 │         │             │ ok             │                │             │       │
 │         │             │ start 2 judges of A in parallel                       │
 │         │             ├──────────────────────────────────────────────▶        │
 │         │             ├──────────────────────────────────────────────▶        │
 │         │                              │ ←api──         │             │       │
 │         │                              │ ok, start judges of O                │
 │         │                              ├─────────────────────────────▶        │
 │         │                              ├─────────────────────────────▶        │
 │         │                                               │ ←api──     │       │
 │         │                                               │ ok, judges of G    │
 │         │                                               ├────────────▶        │
 │         │                                               ├────────────▶        │
 │         │             ...all 6 judge calls eventually settle...               │
 │         │ Promise.allSettled completes                                        │
 │         │ fireSynthesis (Anthropic call)                                      │
 │         ├──────────────────────────────────────────────────────────────────▶ │
 │         │                                                              ←api──┤
 │         │ render synthesis                                                    │
 │ ◀──────┤                                                                      │
```

In the worst case (slowest source happens to be Anthropic, slowest
judges are also slow), the total wall-clock time is approximately:

```
T_total ≈ max(T_sourceA, T_sourceO, T_sourceG)
       + max over each source of max(T_judge1, T_judge2)
       + T_synthesis
```

In practice, the second term is shorter than its bound because faster
sources begin judging earlier, overlapping the slowest source's tail.

### 4.3 Error Propagation Through the Pipeline

Errors do not abort the pipeline. They are converted to UI states and
the pipeline continues. The pipeline guarantees:

- A failed source call sets its panel to `error` and marks both of its
  outgoing judge slots as `errored` with the reason "Source call
  failed". No judge calls are issued for a failed source — there is
  nothing to judge.
- A failed judge call sets the verdict's badge/pill/explanation to one
  of three diagnostic states (`empty`, `unparseable`, `errored`)
  depending on what specifically went wrong, but does not affect any
  other call.
- A failed synthesis call sets the synthesis body to an error state
  but does not invalidate the other tabs.
- A missing API key for any provider does not abort the run; it sets
  that provider's panel to error and continues with the remaining two.

The orchestrator's use of `Promise.allSettled` (rather than
`Promise.all`) is the mechanism that enforces this. A single rejected
promise inside the chain does not bubble out and abort the rest.

---

## 5. Provider Integration

### 5.1 Uniform Client Signature

The three provider client functions present a uniform signature so they
can be dispatched through `PROVIDER_CALL[provider]`:

```ts
async function callX(key: string, model: string, prompt: string, maxTokens?: number): Promise<string>
```

All three:

- Issue a single `fetch` POST.
- Throw a generic `Error` on non-2xx HTTP responses, with the status
  code and the raw response body in the message.
- Throw the custom `EmptyResponseError` when the API returns 2xx but
  the content is empty or whitespace-only. The error message contains
  provider-specific diagnostic data (stop/finish reason, token usage)
  to make the cause distinguishable.
- Return a single `string` on success.

This uniformity lets the orchestrator treat the three providers as
interchangeable for both source and judge roles. The differences
between the providers — request shape, response shape, header
requirements — are fully encapsulated in the three client functions.

### 5.2 Per-Provider Request Surface

| Provider | Endpoint | Auth | Body shape | Response path |
|---|---|---|---|---|
| Anthropic | `POST /v1/messages` | `x-api-key` header + `anthropic-dangerous-direct-browser-access: true` | `{model, max_tokens, messages:[{role,content}]}` | `data.content[].text` joined |
| OpenAI | `POST /v1/chat/completions` | `Authorization: Bearer` | `{model, messages, max_completion_tokens}` | `data.choices[0].message.content` |
| Google | `POST /v1beta/models/{model}:generateContent?key=…` | API key in query string | `{contents:[{parts:[{text}]}], generationConfig:{maxOutputTokens}}` | `data.candidates[0].content.parts[].text` joined |

### 5.3 Token Budget Asymmetry

```js
TOKEN_BUDGETS = { anthropic: 4096, openai: 16384, google: 4096 }
SYNTHESIS_MAX_TOKENS = 8192
```

The OpenAI budget is four times that of the others. This is intentional
because OpenAI reasoning-capable models (GPT-5, o-series) consume
tokens against `max_completion_tokens` for their internal reasoning
*before* producing any visible output. A budget set to match the
visible-output budget for the other providers commonly produces empty
responses — the model exhausts its budget on reasoning and never emits
content. The `EmptyResponseError` raised by `callOpenAI()` includes
`reasoning_tokens` from the usage payload precisely so this failure
mode is visible to the user.

The synthesis call uses 8K rather than 4K because the synthesis is the
longest single output in the pipeline and benefits from headroom.

### 5.4 EmptyResponseError Semantics

The distinction between a network/HTTP failure and an empty 2xx is
significant enough to warrant a separate exception type. An empty
response is *successful at the API level* — the request was accepted,
billed, and produced a structured reply — but the content the user
needs is absent. The two cases require different remediation (network
diagnostics vs. token budget adjustment), so the UI treats them as
distinct states (`errored` vs. `empty` in `setVerdict()`).

---

## 6. Judge Subsystem

### 6.1 Prompt Construction

`buildJudgePrompt(sourceProvider, sourceModel, originalPrompt, sourceResponse)`
produces a single string containing:

1. A role statement ("independent evaluator").
2. The original user prompt (verbatim, wrapped in `"""..."""`).
3. The source response being evaluated (verbatim, wrapped).
4. An instructions block specifying:
   - Output a 0–100 numeric score.
   - Identify factual claims.
   - State accuracy of each claim.
   - Cite credible sources.
   - Flag unverifiable / stale claims.
   - Flag conflicts of interest.
   - Markdown is permitted in the explanation.
5. A strict format directive: `SCORE: <int>` followed by `EXPLANATION:` followed by the explanation body.

The instructions to *cite sources* and *flag conflicts of interest* are
deliberate features of the experiment. The application does *not*
verify that the cited sources exist or that the cited conflicts are
real; surfacing the model's self-reported epistemic confidence is
itself the data being collected. Citation hallucination is an
expected, observed failure mode.

### 6.2 Response Parsing

`parseJudgeReply(raw)` returns `{ score, explanation, raw }`. It is
deliberately permissive:

- **Score extraction.** First, look for the explicit `SCORE: N`
  pattern, case-insensitively. If not found, fall back to the first
  integer 0–100 anywhere in the text. If still not found, `score` is
  `null` and the verdict is rendered as `unparseable`.
- **Explanation extraction.** First, look for an `EXPLANATION:` label
  and take everything after it. If not found, strip the score line
  from the beginning of the text and use the remainder. If that is
  empty too, use the whole text.
- **Defensive guards.** The parser tolerates `null`, `undefined`, and
  empty inputs. Every path returns a fully populated result object so
  downstream code never receives `undefined` for a field it dereferences.

This permissiveness is a v3.1+ design decision. Earlier versions
crashed downstream when a judge model emitted a slight format
deviation; the v3.1 hardening pattern was to always return a complete
object and *classify* the result rather than reject it.

### 6.3 Verdict State Machine

A single source-judge pair has six possible UI states. Transitions are
strictly source-state-driven (the parser/orchestrator decides which
state to enter; the UI does not transition autonomously).

```
            ┌─────────┐
            │ reset   │ ← clearResponses() / sendPrompt() entry
            └────┬────┘
                 │ fireJudge() called
                 ▼
            ┌─────────┐
            │ pending │
            └────┬────┘
                 │
   ┌─────────────┼──────────────────────┐
   │             │                      │
   ▼             ▼                      ▼
┌────────┐  ┌──────────┐           ┌─────────┐
│ scored │  │unparseable│          │ errored │
└────────┘  └──────────┘           └─────────┘
                                  ▲    ▲
                                  │    │ EmptyResponseError? → empty
                                  │    │
                                ┌─┴────┴───┐
                                │  empty   │
                                └──────────┘
```

The `empty` state is functionally a subtype of `errored` but is
visually distinct (amber pill + diagnostic text) because its
remediation differs (raise the token budget rather than investigate
network/credentials).

### 6.4 Dual Rendering

Every verdict appears in **two places** in the DOM:

- **Compact badge** on the Responses tab, attached to the source
  response panel. ID pattern: `verdict-{source}-{judge}`.
- **Full pill + explanation** on the Veracity Check tab. ID patterns:
  `pill-{source}-{judge}` and `explain-{source}-{judge}`.

`setVerdict()` mutates all three elements in a single call. The DOM
naming convention is the single source of truth for the source-judge
mapping — no JavaScript table maps elements; the function constructs
the ID strings directly from the provider names.

---

## 7. Synthesis Subsystem

### 7.1 Prompt Construction

`buildSynthesisPrompt(cfg)` assembles the full input from `runState`:

1. A role statement.
2. The original user prompt (verbatim).
3. The three models' identities (provider + model id).
4. Each of the three source responses, or an explicit
   `(no response received - skip this model in your synthesis)`
   placeholder for missing ones.
5. Each successful judge verdict (score and explanation), or a
   fallback note if zero judges succeeded.
6. The composition instructions.
7. The annotation tag instructions (`<spin>` and `<dispute>`).
8. Formatting guidelines and prohibitions.

The annotation instructions are the policy that the synthesis model
applies to its own output. They mandate:

- Inline tagging (not paragraph-level).
- No nesting.
- No HTML beyond the two tags and standard markdown.
- Restrained use of tags (most of the synthesis unmarked).
- No meta-commentary, no `Synthesis:` headings.

The tag-policy is implemented by *prompting only*. There is no
post-hoc validator that re-tags claims if the synthesizer applies the
policy incorrectly. This is acknowledged as Limitation L-4.

### 7.2 Synthesis Stats

`computeSynthesisStats()` returns:

```ts
{ sources: number,     // 0..3, count of non-null responses
  evals:   number,     // 0..6, count of scored judgments
  avg:     number|null // average of scored judgments, or null if none
}
```

These three numbers populate the metadata strip on the Truth Be Told
tab. They are computed *before* the synthesis call begins so the
metadata is visible while the synthesis is in flight.

### 7.3 Pre-Flight Guards

The synthesis call is skipped (with an explanatory error in the body)
in two cases:

- No Anthropic key configured. Anthropic is the designated synthesizer;
  no fallback to a different synthesizer is implemented.
- Zero source responses succeeded (all three providers failed). With
  no source material, there is nothing to synthesize.

These guards are checked *before* the loading state is shown, so a
guard-skip is instantaneous.

### 7.4 Tab-Pulse Notification

While the synthesis is in flight, the Truth Be Told tab button
displays a pulsing dot if the user is not currently viewing that tab.
The pulse:

- Is added by `fireSynthesis()` only if the truth tab is not active.
- Is cleared by `showTab('truth')` when the user clicks the tab.
- Is cleared by `clearResponses()` on a reset.

The mechanism is intentional: synthesis takes 15–60 seconds, and the
user is likely to scan the Responses or Veracity Check tabs during
that time. The pulse signals that the deliverable has arrived without
interrupting their browsing.

---

## 8. Rendering Pipeline

### 8.1 Inline Markdown Parser

`renderMarkdown(text)` is a small inline parser that handles the
markdown subset documented in §4.7 of the functional spec. The full
pipeline, in order:

1. **Extract fenced code blocks** into a placeholder array
   (` C{idx} `) so their contents are not processed by other
   rules. This protects the contents of code blocks from the inline
   rules that follow.
2. **Escape all HTML** in the remaining text (`& < >`). This is the
   sanitization step. Any HTML present in model output is now inert.
3. **Inline code** (`` `…` ``) → `<code>…</code>`.
4. **Headers** (`####`, `###`, `##`, `#`) → `<h4>` ... `<h1>`.
5. **Horizontal rules** (`---`, `***`, `___`) → `<hr>`.
6. **Bold and italic** (`**`, `__`, `*`) → `<strong>` and `<em>`. Bold
   patterns are matched first so italic does not consume bold's stars.
7. **Links** `[text](url)` → `<a href target="_blank" rel="noopener">`.
8. **Lists and blockquotes** — line-based pass. Tracks open `<ul>`,
   `<ol>`, `<blockquote>` and emits open/close tags as the prefix
   pattern changes line-to-line.
9. **Paragraphs** — split on blank lines; wrap non-block content in
   `<p>`; single newlines within a paragraph become `<br>`.
10. **Restore code blocks** by re-substituting the placeholders, with
    the code text re-escaped before being placed inside
    `<pre><code>…</code></pre>`.

The parser is intentionally not a CommonMark or GFM implementation.
It targets *what LLMs actually emit* with high fidelity, which is a
much smaller surface than the full spec. Edge cases beyond this
subset (nested code spans, tables beyond basic form, raw inline HTML)
may render imperfectly; that is acceptable.

### 8.2 Annotation-Aware Variant

`renderSynthesisMarkdown(text)` exists only for the Truth Be Told body.
It interleaves three steps:

1. **Extract `<spin>` and `<dispute>` blocks** into placeholders
   (`T{idx}`) before HTML escaping. The two tag types and
   their inner content are captured by a single regex with a
   backreference.
2. **Run the full `renderMarkdown` pipeline** on the surrounding text.
   Because the tags have been replaced with placeholders, the markdown
   parser escapes any *other* HTML the model emitted, including
   malformed or adversarial markup.
3. **Restore the tags as `<span>` elements**, with the inner content
   *also* recursively run through `renderMarkdown` so that markdown
   inside annotations renders correctly (e.g., `<spin>**bold**</spin>`
   renders bold and yellow). The wrapping `<p>` and `</p>` are
   stripped from the inner render; intermediate `</p><p>` boundaries
   become `<br><br>` so a multi-paragraph annotation flows inline.

The restored span has a hard-coded class (`spin` or `dispute`) and a
hard-coded `title` attribute ("Minor spin or imprecision" or "Disputed
or contested claim"). The title is not derived from model output, so
it is not an injection vector.

### 8.3 Injection Resistance

The pipeline is **escape-then-introduce**, not **strip-or-allowlist**.
That is:

- Any raw HTML in the model output is escaped to text before *any*
  markdown rules run.
- The only HTML in the rendered output is HTML produced by the local
  renderer (with hard-coded tag names and attribute values) or, in the
  synthesis case, the two annotation spans whose only model-derived
  content is the *text* between the tags, which itself was run
  through the same escape-then-introduce pipeline.

There is no possible path by which a model can introduce a `<script>`,
`<iframe>`, `<style>`, `onload=`, `href="javascript:"`, or other
executable construct into the rendered DOM. This is a strong property
delivered by a small amount of code and is the basis of the security
position described in §10 of the functional spec.

### 8.4 Failure Mode of the Renderer

If the renderer throws (which it should not, but defensive coding
elsewhere assumes it might), the calling code in `setPanel()` and
`setSynthesisBody()` does not have an explicit try/catch around it.
The pragmatic fallback is the browser's standard error surface; the
panels would remain in their pre-render state. In practice this has
not occurred because the parser is closed over a small, well-defined
input shape.

---

## 9. UI Layout and State Machines

### 9.1 Page Structure

The single page has a fixed vertical structure:

```
┌──────────────────────────────────────────────────────────────┐
│ header: brand + version meta                                 │
├──────────────────────────────────────────────────────────────┤
│ warning banner (browser-side keys)                           │
├──────────────────────────────────────────────────────────────┤
│ settings (collapsible) - 3 columns x (key, model)            │
├──────────────────────────────────────────────────────────────┤
│ prompt textarea + [Send] [Clear] + Ctrl+Enter hint           │
├──────────────────────────────────────────────────────────────┤
│ tabs: [Responses] [Veracity Check] [Truth Be Told ●]         │
├──────────────────────────────────────────────────────────────┤
│ active tab content area                                      │
├──────────────────────────────────────────────────────────────┤
│ footer                                                       │
└──────────────────────────────────────────────────────────────┘
```

The tab area swaps between three panels by toggling an `.active`
class. All three panels are always in the DOM; they are not
constructed lazily.

### 9.2 Panel State Machine (Responses tab)

Each provider panel has four states, mirroring the source-call lifecycle.

```
       ┌──────┐
       │ idle │ ← initial, also after clearResponses()
       └──┬───┘
          │ fireSource() begins
          ▼
       ┌────────┐
       │ loading│ ← amber pulsing dot, "Querying..."
       └──┬─────┘
          │ promise settles
   ┌──────┴──────┐
   ▼             ▼
┌────────┐  ┌────────┐
│ success│  │ error  │
└────────┘  └────────┘
```

`setPanel(id, state, text, ms)` is the single mutation point. It
clears all state classes, applies the new one, sets status text and
elapsed time, and renders the body (markdown for success, plain text
for error, placeholder for loading).

### 9.3 Synthesis State Machine (Truth Be Told tab)

```
        ┌──────┐
        │ idle │ ← initial, also after clearResponses()
        └──┬───┘
           │ fireSynthesis() pre-flight passes
           ▼
        ┌─────────┐
        │ loading │ ← pulsing dot, tab-pulse if user is elsewhere
        └──┬──────┘
           │
   ┌───────┴────────┐
   ▼                ▼
┌────────┐     ┌────────┐
│ success│     │ error  │
└────────┘     └────────┘
```

The `idle` state additionally hides the metadata strip; once stats are
computed (at the start of `fireSynthesis`) the strip becomes visible
and remains visible through `success` or `error`.

### 9.4 Verdict State Machine

See §6.3 above.

### 9.5 Color and Typography Choices

The palette is dark, monochrome-leaning, with per-provider accent
colors:

- **Anthropic**: `#d68a5a` (warm amber)
- **OpenAI**: `#7bc99a` (mint green)
- **Google**: `#7ba4d6` (cool blue)

The score color encoding is independent of provider:

- **70–100**: green (`--success`)
- **40–69**: amber (`--warn`)
- **0–39**: red (`--error`)

Annotation color matches the verdict-band score colors so that the
visual language is consistent across the application: amber means
"caution", red means "contested", green means "consensus / verified".

Typography pairs **JetBrains Mono** (the instrument's typeface — used
throughout the panels, settings, and verdicts) with **IBM Plex Serif
italic** (used for headings and the synthesis body). The serif italic
treatment of the synthesis is deliberate: it visually separates the
*deliverable* — the synthesized answer — from the *measurements* —
the raw responses and verdicts. The user is meant to perceive these
as different kinds of object.

### 9.6 Responsive Behavior

The three-column grids on the Responses and Veracity Check tabs
collapse to a single column at viewport widths below 1100px. The
settings panel collapses similarly at 900px. There is no other
breakpoint behavior; the application is designed for desktop use.

---

## 10. Configuration Lifecycle

### 10.1 Load (boot)

`loadConfig()` runs once on script execution (last line of the script
block). It:

1. Reads `triangulation_v4_1_config` from `localStorage`.
2. If absent, walks the `LEGACY_KEYS` array in order, taking the first
   key that produces a non-null payload.
3. Parses the JSON, populates the six input fields, and calls
   `updateModelLabels()` to refresh the panel/subject model labels.
4. Swallows any exception with a `console.warn`. Failure to load
   config does not block the application.

### 10.2 Save

`saveConfig()` reads the six fields, trims whitespace, writes the JSON
to `localStorage`, refreshes the labels, and flashes a transient
"Saved" indicator for 1.5 seconds.

### 10.3 Clear

`clearKeys()` prompts with `confirm()`, then:

- Removes the storage key.
- Empties the three key fields.
- Resets the three model fields to their defaults (`claude-opus-4-7`,
  `gpt-5`, `gemini-2.5-flash`).
- Refreshes labels.

Notably, `clearKeys()` does *not* touch the run state or the response
panels — it is purely a credential operation. `clearResponses()` is
the separate operation that resets the UI without touching config.

### 10.4 Model Label Live Updates

A keystroke listener on each model field calls `updateModelLabels()`
on every input event. The label under each provider's panel title and
each subject column's header reflects the field value in real time,
even before `saveConfig()` is invoked. This gives the user immediate
feedback on what model the next prompt will use, without requiring an
intermediate save.

---

## 11. Security Design

### 11.1 Threat Model

The application is designed for a single trusted user running on their
own machine. The threat model excludes:

- Multi-user deployment.
- Hostile network (the user is responsible for HTTPS and DNS hygiene).
- Hostile browser extensions (which can always exfiltrate credentials
  on any site).

The threat model *includes*:

- A malicious or compromised LLM provider producing adversarial output
  intended to inject HTML or JavaScript into the rendering surface.
- Accidentally adversarial output (a model emitting `<script>` tags in
  good faith as part of a code example).
- Credential leakage via shoulder surfing (mitigated by `password`
  input type).

### 11.2 Sanitization Pipeline

See §8.3. The pipeline is escape-then-introduce; no model output ever
reaches the DOM as raw HTML.

### 11.3 Credential Surface

API keys live in:

- The DOM, as the values of `<input type="password">` fields. Visible
  in DevTools when the user inspects.
- `localStorage`, as plaintext under the storage key.
- HTTP request headers (Anthropic, OpenAI) or query strings (Google)
  during API calls. Visible in the Network tab.

The application makes no attempt to obfuscate, encrypt, or otherwise
protect these surfaces. The warning banner is the user-visible
acknowledgement of this.

### 11.4 Cross-Origin Position

All three provider APIs accept browser-origin requests under
documented conditions:

- Anthropic requires the `anthropic-dangerous-direct-browser-access:
  true` header to be explicitly set. The application sets this
  unconditionally.
- OpenAI accepts the standard `Authorization: Bearer` header from any
  origin.
- Google accepts the API key in the query string from any origin.

The application makes no requests to its own origin (it has no own
origin in the `file://` case), so there is no CORS configuration to
maintain.

---

## 12. Error Taxonomy

A unified table of every error state the application can present:

| Surface | State | Trigger | Distinguishing UI |
|---|---|---|---|
| Source panel | error | No API key | Red dot, body: "No API key configured." |
| Source panel | error | HTTP non-2xx | Red dot, body: status + raw response body |
| Source panel | error | EmptyResponseError | Red dot, body: provider-specific diagnostic |
| Source panel | error | Network/JSON failure | Red dot, body: error message |
| Verdict | errored | No judge API key | Badge `—` (gray), explanation: "No API key for judge" |
| Verdict | errored | Judge source-call failed | Badge `—` (gray), explanation: "No source response to judge" or "Source call failed" |
| Verdict | errored | Judge HTTP/network failure | Badge `—` (gray), explanation: error message (truncated 500 chars) |
| Verdict | empty | Judge 2xx with empty content | Badge `EMPTY` (amber), explanation: diagnostic + token-budget hint |
| Verdict | unparseable | Judge text but no 0–100 integer | Badge `?` (gray), explanation: raw text (truncated 2000 chars) |
| Synthesis | error | No Anthropic key | Red dot, body: "Add the key in Configuration." |
| Synthesis | error | No source data | Red dot, body: "All three model calls failed." |
| Synthesis | error | Anthropic HTTP/network failure | Red dot, body: error message |
| Synthesis | error | Anthropic empty response | Red dot, body: EmptyResponseError text |

Two cross-cutting properties of this taxonomy:

- **No silent failure.** Every error path produces a visible UI signal
  with a diagnostic. There are no try/catch blocks that swallow errors
  without rendering them.
- **No retry.** The application does not auto-retry any failure. The
  user re-submits the prompt to retry. This is a deliberate decision
  to keep cost predictable: the worst case for a misconfigured key is
  one wasted call, not an exponential-backoff cascade.

---

## 13. Extension Points

The single-file architecture makes the following kinds of change
trivial; each requires editing one or two functions:

| Change | What to edit |
|---|---|
| Add a fourth provider | Add a `callX()` function, add an entry to `PROVIDER_CALL`, `TOKEN_BUDGETS`, `PROVIDERS`, `DISPLAY`; duplicate the per-provider HTML in the three tabs and the config panel; the orchestrator already loops over `PROVIDERS`. |
| Rotate the synthesizer | `fireSynthesis()` calls `callAnthropic` directly. Replace with `PROVIDER_CALL[chosenProvider]` and adjust the pre-flight key check. |
| Change a token budget | Edit `TOKEN_BUDGETS` or `SYNTHESIS_MAX_TOKENS`. |
| Modify the judge instructions | Edit `buildJudgePrompt()`. |
| Modify the synthesis instructions | Edit `buildSynthesisPrompt()`. |
| Add a new annotation tag (e.g. `<verified>`) | Add a CSS rule for `.synthesis-body .verified`; expand the regex in `renderSynthesisMarkdown()`; document the new tag in the synthesis prompt. |
| Add a new markdown construct | Add a case to `renderMarkdown()`. |

The following changes are *not* trivial under the current architecture
and would warrant a larger restructuring:

- Streaming output (requires moving from `fetch` + JSON to streaming
  parsers per provider, plus incremental DOM updates).
- Run history / export (requires a persistence schema for full runs
  rather than just configuration).
- Multi-turn conversation (requires a conversation history data model
  and prompt assembly logic that threads prior turns).
- External substrate integration (the v5+ direction described in §13
  of the functional spec; introduces a fourth tab and a re-evaluation
  pipeline).

---

## 14. Design Rationale Summary

A condensed table of the most consequential design choices and the
reasoning behind each.

| Choice | Rationale |
|---|---|
| Single static HTML file, no build | Auditable in one read; preservable as a forensic artifact alongside prior versions; no toolchain rot. |
| Browser-direct LLM API calls (no proxy) | Required to honor the single-file constraint. The cost is the credential-surface warning in §11. |
| `Promise.allSettled` throughout | Errors must not abort the pipeline. Every error is converted to a UI state and the rest of the run continues. |
| Per-source judge fan-out (rather than wait for all sources) | Reduces total wall-clock time by overlapping judge work with the slowest source. |
| Separate verdict states `errored` / `empty` / `unparseable` | Each has a different remediation. Conflating them obscures the diagnostic signal. |
| Inline markdown parser, not a CDN library | Eliminates the single external runtime dependency. Targets the markdown subset LLMs actually emit. |
| Escape-then-introduce HTML pipeline | Strong injection resistance with a small amount of code. The only HTML in the DOM is locally generated. |
| `<spin>` and `<dispute>` rendered as text color only | Visual quietness — the synthesis is meant to read as prose with caveats, not as a highlighted document. |
| Anthropic as the synthesizer | Practical: the application originated as an Anthropic-centric experiment. Acknowledged as Limitation L-2; rotation is a viable extension. |
| Defensive parser (always returns a complete object) | A v3.1 lesson: downstream code assumed result shape. The parser now guarantees it. |
| Live model-label updates | The user sees immediately what model the next run will use, without needing to save first. |
| Tab-pulse on Truth Be Told during synthesis | The synthesis is long-running. The user is likely to be on another tab. A small visual signal arrives without interrupting. |
| `localStorage` config with legacy fallback | A user who opens v4.1 after using v3.x recovers their keys automatically. The schema has been stable, so no migration logic is needed. |

---

## 15. File and Symbol Index

A quick index of where to find things in `triangulation_v4_1.html`:

| Looking for... | Locate |
|---|---|
| CSS palette / tokens | `<style>` top, `:root { --bg: ...; }` |
| Provider accent colors | CSS selectors `.panel[data-provider="..."]` and `.config-group[data-provider="..."]` |
| Three tabs markup | `<div class="tabs">` and the three `<div class="tab-panel">` |
| Settings/config panel | `<div class="settings">` |
| Storage key and legacy keys | Top of `<script>`, `STORAGE_KEY` and `LEGACY_KEYS` |
| Token budgets | `TOKEN_BUDGETS` and `SYNTHESIS_MAX_TOKENS` |
| Run state object | `const runState = { … }` |
| Provider client functions | `callAnthropic`, `callOpenAI`, `callGoogle` |
| Judge prompt | `buildJudgePrompt` |
| Judge reply parser | `parseJudgeReply` |
| Synthesis prompt | `buildSynthesisPrompt` |
| Markdown renderer | `renderMarkdown`, `renderSynthesisMarkdown` |
| Pipeline entry point | `sendPrompt` |
| Keyboard shortcut wiring | Last lines of `<script>` |

---

## 16. Relationship to Future Versions

This design is a *terminal* design for the LLM-on-LLM evaluation
paradigm. v5+ is expected to break the single-file constraint by
introducing an external knowledge substrate (whether tool-grounded,
document-grounded, or knowledge-graph-grounded). At that point:

- The fan-out shape (3 sources, 6 judgments, 1 synthesis) becomes one
  *layer* of the pipeline. A new *scrubber* layer runs after synthesis
  and re-annotates claims by substrate verification.
- The verdict color encoding extends to four states (supported,
  unmarked, uncovered, contradicted) per §13.2 of the functional spec.
- The annotation tags expand to include substrate-derived flags.
- The architectural property "all evaluation is LLM-internal"
  (Limitation L-1) ceases to hold.

The v4.1 design is preserved as a *baseline* against which the v5+
substrate-grounded behavior can be A/B-compared. The same prompt run
through v4.1 and v5 should expose precisely those claims for which
LLM peer review and substrate verification disagree — which is the
data point the entire experimental program is collecting.
