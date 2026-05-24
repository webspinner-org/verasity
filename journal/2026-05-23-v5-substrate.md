# v5 Substrate Tab — implementation journal — 2026-05-23

## What v5 adds

A fourth tab — **Substrate** — implementing §13.2 of the functional spec.
After the synthesis completes, the user pastes an authoritative passage
into a textarea and clicks **Re-evaluate against substrate**. A new
Anthropic call (the *scrubber*) re-emits the synthesis with three new
substrate-grounded annotation tags:

| Tag | Meaning | Color |
|---|---|---|
| `<supported>` | Source passage directly affirms the claim | green (`--success`) |
| `<uncovered>` | Claim is on-topic but the passage is silent on it | yellow (`--warn`) |
| `<contradicted>` | Source passage directly refutes the claim | red (`--error`) |

Unmarked text is treated as "irrelevant or unclear" — the implicit
gray fourth state from the spec. The renderer is the same one used
for the synthesis tab; it now handles all five tags (the original
`<spin>`/`<dispute>` plus the three substrate tags) through a single
`ANNOTATION_TITLES` table.

## Why this is the v5 step (and not something else)

§13.1 of the spec calls out L-1 ("LLM-on-LLM evaluation") as the
"principal limitation" of v4.1. §13.2 then explicitly identifies the
Substrate Tab as "the most likely first step toward substrate
integration" and characterizes it as "minimal substrate ... sufficient
to demonstrate the architectural shift while remaining fully
client-side and prompt-driven." That brief matches our single-file
constraint exactly, so this was the right v5 to ship now.

The alternatives mentioned in §13.4 (streaming output, run history,
export, configurable provider list, pluggable synthesizer, A/B mode,
batch mode) are useful but tangential to the central thesis that the
application exists to surface.

## Architecture

The pipeline grows by one phase:

```
Phase 1 (source x3) → Phase 2 (judge x6) → Phase 3 (synthesis x1)
                                                                 ↘
                                                  Phase 4 (scrub x1, manual)
```

Phase 4 is **manual**: it does not auto-run after synthesis the way
synthesis auto-runs after the judging phase. The user has to provide
a substrate, and providing one is itself an editorial act (which
passage counts as authoritative?). Auto-running on every prompt
without substrate would be meaningless; gating on user input keeps
the architecture honest about what the substrate represents.

The scrubber always uses Anthropic, matching the synthesizer's
provider choice. This preserves Limitation L-2 ("synthesizer
self-reference") with the same trade-off acknowledged in §12.1 of
the spec; a future v5.1 could rotate providers for both phases.

## Data model changes

`runState` grows two fields:

```js
runState.synthesis = null;             // raw text, set on synthesis success
runState.substrate = {
  text: '',                            // user-pasted authoritative passage
  label: '',                           // optional citation/source label
  scrubbed: null                       // raw text, set on scrub success
};
```

`STORAGE_KEY` bumps to `triangulation_v5_config`. `LEGACY_KEYS`
prepends `triangulation_v4_1_config`, preserving the chain. The
persisted config schema is unchanged — the six fields are the same
six fields. The key bump is purely for behavioral versioning.

## UI additions

- A fourth tab button with a `#substrate-pulse` indicator dot,
  mirroring the Truth Be Told pulse pattern.
- A new tab panel containing:
  - A header with title, subtitle, status dot, and elapsed-time.
  - A 140px-min-height textarea for the source passage.
  - A single-line citation/label input.
  - A primary action button (`#substrate-btn`) and a Clear button.
  - A hint span that explains why the button is disabled, if it is.
  - A 4-item legend (supported / unmarked / uncovered / contradicted).
  - A meta strip with supported/uncovered/contradicted counts and a
    derived **coverage** percentage = `supported / (supported + uncovered + contradicted)`.
  - The scrub output body, using the same serif typeface as the
    synthesis body and the same `.md` markdown class.
- New CSS classes `.supported`, `.uncovered`, `.contradicted` on
  both `.synthesis-body` and `.scrub-body`, applying text color
  only (no background, no underline — same restraint as v4.1's
  spin/dispute).

## Scrub button enable logic

The button is enabled when **both** conditions hold:

1. `runState.synthesis` is non-empty (a synthesis has completed),
2. The substrate textarea has non-whitespace content.

The hint span explains which condition is unmet, if any. The button
is wired to two events: synthesis completion (via
`updateSubstrateButtonState()` called from `fireSynthesis`) and
substrate-text input.

## Pulse-on-scrub behavior

The Truth Be Told pulse pattern is: show pulse only if user is on
another tab when synthesis starts; clear on tab focus. That works
because synthesis is auto-triggered from the prompt area and the
user is typically NOT on the Truth Be Told tab when it kicks off.

For Substrate, the user IS on the Substrate tab when they click
the button (that's how they get to the textarea). The same pattern
would never show the pulse. So the substrate pulse is shown
**unconditionally** at scrub start; `showTab('substrate')` clears
it. If the user navigates away during the scrub, they see the
pulse on the tab strip; if they stay, they see it in the tab they're
viewing (which is harmless and confirms scrub is in flight).

This is a deliberate divergence from the Truth Be Told pattern,
documented inline in the script.

## Renderer changes

`renderSynthesisMarkdown` now matches a five-tag regex:

```js
/<(spin|dispute|supported|uncovered|contradicted)>([\s\S]*?)<\/\1>/gi
```

Tooltip titles for all five tags live in a single `ANNOTATION_TITLES`
object. A `renderScrubMarkdown(text)` alias is exported for clarity;
it is functionally identical to `renderSynthesisMarkdown`.

The escape-then-introduce HTML pipeline is unchanged. Any HTML in
model output that isn't one of the five whitelisted tag names is
escaped to text. The security position from §10.3 of the spec holds.

## Coverage metric

`computeScrubStats(scrubText)` returns:

```ts
{
  supported:    number,   // count of <supported> tags
  uncovered:    number,   // count of <uncovered> tags
  contradicted: number,   // count of <contradicted> tags
  coverage:     number | null   // supported / (supported + uncovered + contradicted)
}
```

`coverage` is null when no tags were applied (substrate is wholly
irrelevant or model declined to tag). When tags exist, it is in [0,1],
displayed as a percentage. The metric is intentionally simple — it
treats every tagged claim as one "claim" regardless of length or
importance. A richer per-claim weighting is left for future work.

## Test inventory delta

| Layer | New tests | Total now |
|---|---|---|
| Unit | +27 (3 new files: scrub-prompt, scrub-stats, scrub-render; +2 in smoke; +1 in config) | 154 |
| Integration | +6 (1 new file: scrub orchestration) | 37 |
| E2E | +6 (1 new file: substrate flow) | 42 |
| **Total** | **+39** | **235** (was 193) |

Two existing E2E tests had to update the `triangulation_v4_1_config`
storage key to `triangulation_v5_config`. The unit `config.test.js`
also gained a new test verifying v4.1 → v5 migration via the legacy
fallback chain.

## Cost / latency impact

A full v5 run with substrate: 10 LLM calls (unchanged from v4.1) plus
**1 more Anthropic call** for the scrub. Typical incremental cost:
$0.01–$0.10 depending on synthesis length, substrate length, and
model. Typical incremental latency: 10–30s. The scrub call is
user-gated, so it only runs when the user is intentionally spending
that cost.

## Open follow-ups

- **Multi-substrate**: today, one passage. Future could accept N
  passages and tag each claim with the BEST-supporting source.
- **Diff view** between the original synthesis (spin/dispute tags)
  and the scrubbed version (supported/uncovered/contradicted tags).
  Useful for studying *when* peer-review and substrate-grounded
  evaluation diverge — which is the central research question.
- **Persisted substrates**: allow the user to save a named substrate
  for reuse across prompts (e.g., "JWST docs", "tax code §61").
- **Rotated scrubber provider**: currently Anthropic only; opening
  this to other providers would address Limitation L-2 partially.
