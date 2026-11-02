# Browser-aware capture implementation plan

> For agentic workers: use superpowers:executing-plans for inline execution.

**Goal:** run the existing capture/paired/suite pipeline in explicitly selected engines without weakening evidence checks.
**Architecture:** add capture-specific selection in `scripts/lib/browser-check.mjs`; pass a single CLI engine through capture, verify, and suite runner. Keep suite manifest schema unchanged. Record actual BrowserType name and version, and validate the requested engine at pair and suite boundaries.
**Tech stack:** Node >=22.12, existing pinned Playwright/pixelmatch/pngjs/Vite, node:test.
**Spec:** `docs/superpowers/specs/2026-11-02-capture-engines.md`.

## Constraints and review focus

No dependencies/lockfile or example edits. Default Chromium remains backward compatible. No silent fallback, TLS bypass, private data, or form submission. Invalid config must fail before output writes. Same wrong engine on both sides must fail; a self-consistent pair alone is insufficient. Keep old report rendering honest. Use separate per-engine directories. Treat external capture availability as a result, not a reason to weaken assertions.

## Tasks

- [x] Add `tests/capture-engine.test.mjs`: helpers, three CLI preflights, propagation, request/observed mismatch, actual local suite and HTTP failure; watch old implementation fail.
- [x] Implement `captureBrowserOptions(options)`; wire `--browser` into three CLIs and `buildVerifyArgs`; enrich suite cases only at execution, not by altering manifest defaults.
- [x] Extend pair/aggregate validation and script-free reports with engine/version; update contract fixtures and keep old-report tests working.
- [x] Run existing full check and all-engine integration on a complete Actions checkout: 303+10 full checks, 39 targeted checks passed, no failures or skips.
- [x] Run the authorized live suite for each engine: 18 cases/30 comparisons completed; inspect representative screenshots and metadata; record remaining WebKit width/wrapping differences.
- [x] Review changed source bytes, confirm no example/dependency changes, and recheck all 30 exact metrics/masks through Pillow/NumPy.
- [ ] Final main integration CI must be checked after publishing; this document records pre-integration code evidence, not a prediction of CI.

## Execution ledger

- Base remote `d6ac5a819365492240e356775e764a86f148cee7`; local text snapshot `1857daf` verified via compare: subsequent commit changes docs only.
- Local baseline: 179 pure/contract tests passed. Container DNS blocks GitHub clone; full dependency/browser execution used Actions.
- Red: 32 assertions failed, 1 passed, 2 browser tests not run. Green local related checks: 218 passed, 2 browser tests not run; full browser claims use the Actions result instead.
- Ruling: CLI-wide engine, no per-case manifest property — keeps one-engine evidence runs unambiguous and scope small.
- One-shot application was pinned to the base and named work branch. It removed its own writer and script before creating `b4040bfd08ed048121f1a836b82dc17665d5bb45`, tree `85c02b5bb40389c51c3885f72dc1a37322126d47`. The reusable workflow is contents:read.
- Actions run `41391886995` completed successfully. Runtime artifact commit/tree match the checked code; 11 changed source/test files match local SHA-256 values. No temporary writer is in the integration tree.
- Live capture: 2026-11-02 05:06:14–05:09:59 UTC. Every engine completed all 10 views. Do not interpret completed/not_requested as visual approval.
- Ruling: preserve WebKit's recorded 384px source layout versus 390px target and the resulting wrapping differences. Do not change CSS or crop captures within this engine-selection feature.
- Review capability: author self-review only, no independent reviewer. [Evidence and limitations](../../case-studies/uulab-services/capture-engines-2026-11-02.md).
- Integration uses the tested tree plus result documents, with the original main as parent, keeping temporary preparation commits out of main history. Check the leased remote head before publishing, then inspect normal and demo-browser CI for the final main SHA.
