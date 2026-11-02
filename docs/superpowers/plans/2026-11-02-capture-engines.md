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
- [ ] Run existing full check and all-engine integration on a complete Actions checkout, not the partial local snapshot.
- [ ] Run the authorized live suite for each engine, inspect representative screenshots and metadata, publish measured results and remaining gaps.
- [ ] Review diff, verify remote head has not moved, integrate with a non-forced leased update, and verify final CI.

## Execution ledger

- Base remote `d6ac5a819365492240e356775e764a86f148cee7`; local text snapshot `1857daf` verified via compare: subsequent commit changes docs only.
- Local baseline: 179 pure/contract tests passed. Container DNS blocks GitHub clone; full dependency/browser execution must use Actions.
- Red: 32 assertions failed, 1 passed, 2 browser tests not run. Green local related checks: 218 passed, 2 browser tests not run; real browsers require the full checkout.
- Ruling: CLI-wide engine, no per-case manifest property — keeps one-engine evidence runs unambiguous and scope small.
- One-shot application workflow is pinned to this base and work branch, removes its own writer and script before committing, and uses a non-forced branch push. The reusable workflow remains contents:read. No temporary writer is to be included in the main tree.
- Review capability: no independent subagent tool is available; perform explicit self-review and label it accordingly.
