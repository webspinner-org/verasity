# Verasity / Triangulation

**Triangulation** is a single-file HTML application that submits a prompt
to three frontier LLMs in parallel, orchestrates a structured cross-evaluation
among them, and synthesizes a single annotated response. It is an experimental
instrument for investigating the gap between *fluency* and *veracity* in
generative-AI output.

The deliverable is `app/triangulation.html`: open it in any modern browser,
configure your API keys for Anthropic, OpenAI, and Google, and submit a prompt.

## Repository layout

```
app/                      Canonical single-file application (open this in a browser)
spec/                     Functional specification + architecture/design document
tests/
  unit/                   Pure-function tests (markdown, parser, prompts, stats, config)
  integration/            Provider API client tests with mocked fetch + sendPrompt orchestration
  e2e/                    Playwright end-to-end tests with mocked provider routes
  helpers/                Test harness for loading the app HTML into a fresh JSDOM
  fixtures/               Shared mock response shapes
journal/                  Dated build / decision logs
triagulation-html/        Original v1–v4.1 iterations (reference only)
.github/workflows/        CI configuration
```

## Running the app

The app has no build step. Two options:

```bash
# Option 1: open directly
open app/triangulation.html

# Option 2: serve locally (avoids file:// quirks with some browsers)
npm run serve
# then open http://127.0.0.1:4173/triangulation.html
```

Configure API keys via the Configuration panel inside the app. Keys are
stored in `localStorage` in plaintext — this is acceptable for local
experimentation only and is **not** suitable for any public deployment.

## Running the tests

```bash
npm install
npm run test:e2e:install   # first run only - installs Chromium for Playwright

# All tests:
npm test

# Or individually:
npm run test:unit
npm run test:integration
npm run test:e2e
```

Test counts (as of the last green run):

- **127** unit tests (Vitest + JSDOM)
- **31** integration tests (Vitest with mocked `fetch`)
- **36** end-to-end tests (Playwright with mocked provider routes)

The unit and integration tests run in Node against a fresh JSDOM document
that loads `app/triangulation.html` and executes its embedded script. The
E2E tests run a real Chromium browser against a local HTTP server and
intercept all outbound provider API calls via Playwright route handlers,
so no real API keys are required.

## Architecture

See `spec/triangulation_functional_spec.md` for the functional specification
and `spec/design.md` for the architecture and design document covering
module layout, data model, orchestration phases, rendering pipeline,
state machines, and security design.

## Continuous integration

Pushes and pull requests to `main` run the full test matrix via GitHub
Actions; see `.github/workflows/test.yml`. The Playwright report is
uploaded as an artifact on failure.

## Status

| Field | Value |
|---|---|
| Application version | 4.1 |
| Spec version | 1.0 |
| Document type | Released |
