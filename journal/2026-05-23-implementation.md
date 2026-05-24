# Implementation journal — 2026-05-23

## What shipped

Built the testable scaffolding around the v4.1 Triangulation application
described in `spec/triangulation_functional_spec.md`.

- `app/triangulation.html` — canonical single-file deliverable. Derived
  from `triagulation-html/triangulation_v4_1.html`. Added a short
  "test surface" block at the very end of the inline script that
  attaches the module's `const` declarations (`PROVIDERS`, `DISPLAY`,
  `TOKEN_BUDGETS`, `SYNTHESIS_MAX_TOKENS`, `STORAGE_KEY`, `LEGACY_KEYS`,
  `runState`, `EmptyResponseError`, `PROVIDER_CALL`) to `window`. No
  behavior change for browser usage; the block exists so a JSDOM-based
  test harness can introspect these values, which are otherwise lexical
  bindings invisible to outside scripts.
- `package.json` with `vitest`, `@vitest/coverage-v8`, `jsdom`,
  `happy-dom`, `http-server`, `@playwright/test`.
- `vitest.config.js` — Node environment (not jsdom), since we create
  fresh JSDOM instances per test in our own helper for full control
  over script execution.
- `playwright.config.js` — bound to port 4173 (8765 was in use by
  another process on this machine).
- `.gitignore` — excludes `node_modules`, `package-lock.json`, test
  output, OS files, and any local agent state.
- `.github/workflows/test.yml` — separate `unit-and-integration` and
  `e2e` jobs.

## Decisions worth remembering

### Single-file constraint kept; testability achieved via a JSDOM harness

The functional spec says the deliverable is a single self-contained
HTML file with embedded CSS and JavaScript. I considered three paths
to make this testable:

1. **Extract the JS into a module** that both the HTML and the tests
   import. Rejected: violates §2.1 of the spec.
2. **Build-step inline** the JS at packaging time. Rejected: spec says
   no build pipeline.
3. **Test against the HTML directly** using JSDOM + script injection.
   Selected.

The chosen approach: `tests/helpers/load-app.js` reads
`app/triangulation.html` from disk, hands it to `new JSDOM(...)` with
`runScripts: 'dangerously'`, and exports an `api(dom)` accessor that
returns the script's public surface. Each test file gets a fresh
JSDOM instance, so there's no cross-test state pollution.

### Vitest's built-in jsdom env didn't execute injected scripts

First attempt used vitest's `environment: 'jsdom'` and tried to inject
the script via `document.body.appendChild(scriptEl)`. The DOM was
populated, but the script never executed (function declarations weren't
on `window`). Even with `environmentOptions.jsdom.runScripts = 'dangerously'`
configured, vitest's wrapper around jsdom didn't honor it for
dynamically-appended scripts. Switched to using the `jsdom` package
directly with `environment: 'node'` — full control, no surprises.

### `const` at script top-level is invisible to outside scripts

The pivotal gotcha: ECMAScript script-level `const`, `let`, and `class`
declarations do **not** create properties on the global object. Only
`var` and `function` declarations do. Since the v4.1 source uses
`const` throughout (modern best practice), my test harness couldn't
read `window.PROVIDERS` even though the script ran successfully and
function declarations attached as expected.

Fix: a six-line test-surface block at the end of the script that
explicitly assigns the relevant constants to `window`. This is a
recognized pattern for making single-file apps testable and is
documented in the implementation journal so future maintainers don't
mistake it for dead code.

### Port 8765 was in use

A pre-existing Python `SimpleHTTPServer` was bound to localhost:8765
on the build machine. Moved the test web server to 4173 (Vite's default
preview port, conventional and unlikely to clash).

### Test pyramid shape

- **127 unit tests** — pure functions: markdown rendering, judge-reply
  parsing, prompt construction, score classification, synthesis stats,
  config storage. Fast: ~700ms total.
- **31 integration tests** — provider API clients with mocked `fetch`,
  plus the full `sendPrompt` orchestration end-to-end with all three
  providers stubbed. ~500ms total.
- **36 E2E tests** — Playwright drives a real Chromium browser against
  a local HTTP server; all three provider APIs are intercepted via
  `page.route()` and given canned responses. ~3s total.

194 tests, all green. No real API keys required at any layer.

### Coverage strategy

Unit tests target each pure function with both happy-path and edge-case
inputs (`null`, `undefined`, empty string, malformed score, boundary
score values, etc.). Integration tests verify wire-format compliance
with each provider's documented API shape and exercise the four
documented verdict states (`scored`, `unparseable`, `empty`, `errored`).
E2E tests verify rendered DOM, applied CSS (color of annotation spans),
keyboard shortcuts, dialog handling, and storage migration from
legacy keys.

## Open follow-ups

None blocking. Potential later work:

- Visual regression tests (Playwright has screenshot diffing).
- Performance / latency assertions (currently ad-hoc).
- A11y audit (`@axe-core/playwright`).
- Coverage report uploaded as a CI artifact.
