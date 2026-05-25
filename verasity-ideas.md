# Verasity: a sovereign AI for fact-checking the internet

| Field | Value |
|---|---|
| Document type | Ideas / research-direction sketch |
| Date | 2026-05-24 |
| Companion to | `spec/triangulation_functional_spec.md`, `spec/design.md` |
| Status | Exploratory — not a commitment |

---

## 1. Premise

The internet is, by volume, mostly text and image that someone
produced for a reason — to inform, persuade, sell, mislead, signal,
or entertain. The reader has no efficient way to ask, in the moment,
"is this specific claim true?" The dominant answers in 2026 are:

- Trust the publisher.
- Trust a platform's signal (Community Notes, NewsGuard score,
  fact-check label).
- Trust a hosted AI (Perplexity, Copilot, Gemini-with-grounding,
  ChatGPT-with-browsing).

All three transfer trust to a third party. A **sovereign** fact-checker
inverts that: the user owns the model, owns the substrate it consults,
owns the verification chain. Nothing the user fact-checks leaves their
machine. Nothing they fact-check can be coerced or quietly reweighted
by an outside party. The user gets a receipt they can share, and
others can verify the receipt independently against their own
substrates.

Triangulation v5 in this repo is the seed: it orchestrates three LLMs,
cross-evaluates their answers, and re-tags claims against a
user-pasted source passage. It's the wrong shape to scale — paste-driven,
single-prompt, no retrieval — but it proves the central pattern.
*Separate the assertion from the evidence; let the user supply the
evidence; render where the assertion does and does not hold.* The
sovereign fact-checker is what happens when that pattern grows
retrieval, persistence, and a portable proof.

---

## 2. What "sovereign" buys

The word is doing a lot of work; specifically:

- **Custody of the model.** Open-weight LLMs (Llama 3.x, Mistral,
  Qwen 2.5, Gemma 3, DeepSeek-R1) running locally via Ollama,
  llama.cpp, vLLM, or LM Studio. The model does not phone home. No
  usage telemetry. No surveillance side-channel.
- **Custody of the substrate.** The user picks the corpora the
  verifier consults — Wikipedia snapshots, arXiv mirrors, government
  open-data sets, their organization's documents, their own files —
  and updates them on their own cadence.
- **Custody of the trust graph.** The user (or a community they
  choose) decides which sources count as authoritative for which
  claim types.
- **An auditable verification chain.** Every verdict reduces to:
  which model produced it, which substrate passages it consulted,
  with what retrieval timestamps, against what extracted claim. The
  chain is reproducible, inspectable, signable.
- **No collusion vector.** A hosted fact-checker can be subpoenaed,
  bought, deplatformed, or quietly reweighted. A sovereign one
  cannot — at least, not without the user noticing.

This is the difference between a "fact-checked by AI" badge and a
verifiable claim about the world.

---

## 3. Existing work, honestly assessed

A taxonomy of what's already been built, and what each does and
doesn't do.

### 3.1 Hosted fact-checking products

- **NewsGuard** — humans score 7,500+ news sites on nine criteria.
  Browser extension. Hosted, paid, slow to update, scope-limited to
  websites (not individual claims).
- **Ground News** — aggregates a story across left/right/center
  sources; surfaces what's reported where and what's omitted. Not
  claim-level.
- **Snopes, PolitiFact, FactCheck.org** — editorial fact-checks,
  long-form articles. Their results are published with
  `ClaimReview` schema markup.
- **Google Fact Check Explorer** — surfaces ClaimReview-tagged
  content from publishers worldwide. Excellent index of *prior*
  fact-checks; doesn't perform new ones.
- **Community Notes (X)** — crowdsourced and on-platform only.
  Specifically vulnerable to coordinated capture in non-English
  contexts.

Two shared limitations: third-party trust, and *they fact-check what
is already famous*. The long tail of arbitrary claims encountered
in normal browsing is uncovered.

### 3.2 Hosted retrieval-augmented LLMs

- **Perplexity, Bing Chat / Copilot, Gemini with grounding,
  ChatGPT with browsing, You.com, Phind, Kagi Assistant** — all
  variants of the same pattern: a hosted LLM, a hosted retriever,
  and a citation list.

Useful for asking. Harder to trust because citations can be
fabricated, the source can be biased, and the user has no control
over what was consulted. Proprietary substrate throughout.

### 3.3 Open standards for provenance and claims

- **C2PA** (Coalition for Content Provenance and Authenticity;
  Adobe, Microsoft, BBC, Intel, et al.) — cryptographic provenance
  manifest attached to media. Strong for "where did this image come
  from"; weaker for "is this assertion true."
- **Project Origin** — sibling effort for news content authenticity.
- **ClaimReview** (Schema.org) — structured markup for fact-check
  publishers. Google indexes it.
- **W3C Verifiable Credentials** — cryptographic claims about
  identity, applicable to "this passage was sourced from substrate
  X at time T, signed by key K".
- **PROV-O** (W3C Provenance Ontology) — RDF vocabulary for
  describing provenance chains.

These standards could carry a sovereign verdict receipt. None of
them describes the *content* of a fact-check; they describe its
*envelope*.

### 3.4 Open-source RAG / verification frameworks

- **LangChain, LlamaIndex, Haystack** — framework-level RAG;
  retrieval, chunking, prompting.
- **DSPy** — programmatic prompt + retrieval optimization.
- **Vector stores**: txtai, Chroma, Qdrant, Weaviate, LanceDB,
  pgvector. All run locally; most run embedded.
- **Retrieval methods**: ColBERT, BM25, hybrid retrievers, dense
  cross-encoders.

The plumbing exists. What doesn't exist — at least not as a unified
project — is a sovereign verifier that combines retrieval, claim
extraction, NLI stance classification, and signed receipts into a
single user-controlled artifact.

### 3.5 Fact-checking research and benchmarks

- **FEVER, FEVEROUS, VitaminC, FActScore, AVeriTeC** — datasets and
  benchmarks for claim verification against Wikipedia and other
  corpora.
- **TrueTeacher, RARR, GopherCite** — research systems that retrieve
  citations and verify generated claims.
- **NLI / textual entailment models** (DeBERTa-NLI and multilingual
  variants) — classify a (premise, hypothesis) pair as entailment,
  contradiction, or neutral. The atomic operation of substrate-grounded
  verification.

Strong academic foundation. Most components are open-source. The
integration is what's missing.

### 3.6 Local-first inference stack

- **Runners**: Ollama, LM Studio, llama.cpp, vLLM.
- **Open-weight models** that perform well at extraction and NLI:
  Llama 3.3, Qwen 2.5, Mistral, Gemma 3, DeepSeek-R1.
- **Embedding models**: bge-large, gte-large, nomic-embed,
  jina-embeddings — all local-runnable.
- **Browser-to-local bridges**: WebExtension talking to
  `localhost:11434` (Ollama) or similar is a well-trodden pattern.

You can stand up a credible local-only stack on a $2,000 Mac with
no cloud calls. The cost of sovereignty has dropped to a few
thousand dollars and a few hours of setup.

---

## 4. Architectural sketch

A user encounters a paragraph on a news site claiming X. They
highlight the paragraph (or invoke a shortcut). What happens next:

### Phase 1 — Capture and decompose

A browser extension grabs the selection (or the full article) and
sends it to a local server. The first job is to break the text into
**atomic checkable claims**. This is harder than it looks: "the
JWST launched in December 2021 from French Guiana" is two claims.
"Vaccines are safe and effective" is two claims, neither atomic.
Research lines: FEVEROUS-style claim decomposition, LLM-based claim
extraction with structured output, AVeriTeC's claim normalization.

Output: an array of atomic claims, each tagged with surrounding
context for back-reference.

### Phase 2 — Retrieve evidence

For each atomic claim, retrieve candidate evidence passages from the
user's substrate. The substrate is a **stack of corpora**, each
labeled with a trust class and a temporal range:

- Wikipedia (last snapshot 2026-05-01)
- arXiv (live, papers up to 2026-05-23)
- Federal Register (USA)
- World Bank Open Data
- Hansard (UK parliamentary record)
- The user's personal document store
- Their organization's internal documents

Retrieval is hybrid: BM25 plus dense vector (bge-large or similar),
per-corpus, with cross-encoder re-ranking on top-50 → top-10. Each
retrieved passage carries provenance — corpus, document, paragraph
ID, retrieval timestamp.

### Phase 3 — Stance classification

For each (claim, passage) pair, classify: **supported / contradicted
/ silent**. This can be a small specialized NLI model
(DeBERTa-class), or an LLM with a JSON-schema-constrained output,
or both in cascade. On the local stack, Llama 3.3 with a constrained
decoder is sufficient for most cases.

Output: per claim, a vector of `{passage_id, stance, confidence}`
tuples.

### Phase 4 — Aggregate to a verdict

Reduce per-passage stances to a per-claim verdict. The reducer is
**explicit and inspectable**: how many supporting passages, how
many contradicting, from which corpora (weighted by trust), with
what cross-corpus agreement. The output is one of:

- **Verified** — multiple high-trust corpora support, no
  contradictions.
- **Likely true** — one corpus supports, no contradictions.
- **Disputed** — corpora disagree.
- **Likely false** — one or more corpora contradict, none support.
- **Uncovered** — no relevant passages found.
- **Time-stale** — supporting passages exist but predate a
  relevant cutoff.

Triangulation v5's `<supported>` / `<uncovered>` / `<contradicted>`
mapping is the same idea in miniature.

### Phase 5 — Annotate and present

The browser overlay re-renders the original passage with inline
annotation — exactly the v5 pattern, scaled up. Hovering a claim
shows the supporting/contradicting passages, the corpora, the
timestamps. Clicking opens the full verification trace.

### Phase 6 — Issue a receipt

A signed JSON-LD receipt is produced, capturing:

- The original text and its URL + timestamp.
- The atomic claims as extracted.
- For each claim: the verdict and evidence pointers (corpus IDs
  plus content hashes).
- The model identifiers and their content hashes.
- The retrieval timestamps.
- A signature over the whole bundle, by the user's key.

The receipt is portable. Anyone with access to the same corpora can
verify the receipt without trusting the user's machine. Anyone can
**challenge** it by producing a counter-receipt against different
substrates. C2PA's envelope, ClaimReview's vocabulary, and PROV-O's
provenance model are all candidate carriers.

### Phase 7 — Share or store (optional)

The receipt can be published — to a personal blog, a Nostr relay,
an internal Slack — and others can either trust the signature or
re-run the verification against their own substrate to confirm.
The result is a network of overlapping verifications, none of which
depends on a central authority.

---

## 5. What's genuinely novel and what isn't

To be honest about value:

**Already solved (just integration work):**

- Local LLM hosting
- Local vector stores
- Claim extraction at "good enough" quality
- NLI stance classification at "good enough" quality
- Cryptographic signing of payloads

**Partially solved (active research):**

- Atomic claim normalization — one assertion per claim, no
  entanglement.
- Cross-corpus reducer logic — when do you weight Wikipedia over
  an academic paper? When does a contradiction matter?
- Temporal reasoning — how do you handle "as of *date*" claims?
- Adversarial robustness — a hostile publisher can frame claims to
  evade extraction.

**Not solved at all:**

- A consensus standard for **fact-check receipts**. C2PA covers
  media provenance, not assertion verification.
- An open, sovereign equivalent of NewsGuard's **publisher trust
  signal** — credible-source curation that doesn't depend on a
  single editorial team.
- The UX problem of **"show me which claims to even worry about"**
  — a page may have 200 claims, most uncontroversial. Triage matters.

The novel contribution this project could make is **the receipt
standard + the trust-graph format + the open reference
implementation**. The plumbing is commodity; what's missing is an
opinionated, signed, portable verification artifact that anyone can
produce and anyone can verify.

---

## 6. What Triangulation v5 already demonstrates

The seed pattern is correct in four ways that matter:

1. **Multiple independent evaluators are better than one** — the
   three-source cross-evaluation surfaces disagreement that a single
   LLM would smooth over.
2. **LLM peer review surfaces uncertainty but does not resolve it** —
   Limitation L-1 in the v4.1 spec. The judges share the same
   architectural blind spots as the source models.
3. **Substrate-grounded evaluation re-tags claims with
   evidence-bound annotations** — the v5 Substrate tab is exactly
   this, with the user supplying the substrate manually.
4. **The output is inspectable** — every claim's tag has a tooltip,
   every verdict is traceable to specific judge output, every score
   has a color-coded confidence band.

What v5 does NOT do — and what the sovereign fact-checker would
have to do — is the **retrieval** step. v5 makes the user paste the
substrate; the full system retrieves it automatically from a
user-curated corpus stack. That's the v6 direction described in
§13.3 of the spec and the bridge between Triangulation-as-instrument
and Triangulation-as-tool.

---

## 7. Smallest interesting prototype

If the goal is to ship something a person could use against arbitrary
internet content in a quarter, the smallest interesting prototype is:

1. **Browser extension** that captures a highlighted passage and
   sends it to a local endpoint.
2. **Local server** running Ollama with a 32–70B-parameter model
   (Llama 3.3, Qwen 2.5, or DeepSeek-R1).
3. **One substrate**: a local Wikipedia snapshot (English,
   monthly dump, ~25GB compressed) indexed with both BM25 and
   bge-large embeddings.
4. **Claim-by-claim verification** using the four-phase architecture
   in §4.
5. **Inline annotation overlay** that re-renders the passage with
   `<supported>` / `<uncovered>` / `<contradicted>` spans —
   Triangulation v5's renderer in this repo is reusable.
6. **Local-only**, no signed receipts yet — just a working pipeline.

Wikipedia alone is enough to fact-check a startling fraction of news
content. It is not enough for cutting-edge science or breaking
news, but it is the right MVP substrate: large, free,
machine-readable, broadly trusted (with caveats), monthly cadence.

**Estimated lift**: two to four weeks of focused work to a working
prototype on Wikipedia. The hardest piece is the claim extractor;
the second hardest is making the UX feel frictionless.

Building blocks:

- Ollama for the model.
- LanceDB or Qdrant for the vector store.
- A 300–500 LOC Python or Rust server orchestrating retrieval +
  NLI + annotation.
- A WebExtension manifest for the browser side.
- Triangulation v5's renderer (open source, in this repo) for the
  overlay.

---

## 8. Open questions the project would have to answer

1. **Who curates the trust graph?** A user has neither time nor
   expertise to evaluate every potential corpus. **Federated
   curation** (a person you trust publishes a substrate stack you
   import) is a plausible answer; nobody has built it.
2. **What does it cost to keep the substrate fresh?** Wikipedia
   dumps are monthly. Breaking news is by definition pre-substrate.
   Some claims simply cannot be checked locally; the system has to
   say so without resorting to "looking it up online" via a
   third-party retriever.
3. **How do you handle uncited but obvious knowledge?** "The sun
   rises in the east" doesn't need a citation; the substrate would
   mark it `uncovered`. The reducer needs a prior over which claims
   warrant skepticism.
4. **How do you handle deliberately ambiguous claims?** "Vaccines
   cause autism in some cases" — partially testable, dependent on
   definitions. A binary supported/contradicted reducer is
   inadequate.
5. **What's the threat model?** Adversarial framing, claim-decomposition
   gaming, retrieval poisoning if the substrate is community-curated,
   model-weight tampering. The threat surface is non-trivial.
6. **Image and video?** A sovereign fact-checker for text leaves
   half the internet uncovered. Deepfake detection, C2PA manifest
   validation, and reverse-image retrieval are adjacent disciplines
   that would have to fold in.
7. **AI-generated content as a special case?** If the article itself
   is LLM output, the fact-checker is checking an LLM's output with
   another LLM. The substrate-grounded step is the only thing that
   makes this not a circle.

---

## 9. Why this is worth building

There is no neutral position in the trust hierarchy of the internet.
Either you decide what counts as evidence, or someone else decides
for you. The cost of "someone else decides" used to be acceptable
because the alternatives required infrastructure most people could
not run. In 2026, that asymmetry has collapsed: a working sovereign
verifier can run on a laptop, against substrates a user can curate
in an afternoon, with cryptographic receipts that travel further
than any centralized verdict.

The project that builds the first credible reference implementation
of this — not the slickest, not the biggest model, but the one with
the clearest receipt standard and the cleanest auditable chain —
shifts the default. The standard becomes the thing other systems
have to interoperate with.

Triangulation v5 is the proof that the inspectable-evaluation
pattern works. The next step is to make it retrieve, sign, and
share — and let the user pick whose evidence counts.

---

## 10. In one sentence

A sovereign fact-checker is a user-owned pipeline that decomposes
arbitrary text into atomic claims, retrieves evidence from corpora
the user controls, classifies each (claim, evidence) pair with an
inspectable model, and emits a signed receipt — and the building
blocks are already commodity; the missing piece is an opinionated
reference implementation plus a receipt standard, neither of which
would be hard to ship.
