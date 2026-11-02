# Scrollbar Fidelity Implementation Plan

> For agentic workers: execute inline using superpowers:executing-plans and test-driven-development.

**Goal:** Remove scrollbar-induced false overflow and reduce the observed WebKit layout mismatch without normalizing source captures.
**Architecture:** Read layout dimensions in the existing DOM collector; warn about mismatched rendered widths in pair assessment; keep the authored example separate from reusable tooling.
**Tech Stack:** Node 22.12+, locked Playwright, existing Vite example.
**Spec:** ../specs/2026-11-02-scrollbar-fidelity.md

## Global Constraints
No dependency or pixel threshold changes. Preserve inaccessible-browser failures. Preserve conservative screenshot allocation dimensions and old evidence. No source-side mutation outside a separately labeled diagnostic page.

## Review Focus
Actual body overflow must remain visible; overlay and classic scrollbars must both work; missing old evidence must not mean equality; malformed geometry cannot look valid; small-view and keyboard menu behavior must not regress.

## Tasks
- [x] Inspect current main, previous evidence, code and baseline tests. Original local related baseline: 52 pass / 2 browser tests not run.
- [x] Add arithmetic/assessment and real-engine regressions in tests/viewport-evidence.test.mjs. Original pre-implementation record: 13 failures / 4 pass / 2 browser tests not run.
- [x] Observe source and implementation in three engines using scripts/case-studies/inspect-uulab-scrollbars.mjs; keep causal diagnostic overrides separate from unmodified captures.
- [x] Update scripts/lib/page-evidence.mjs and scripts/lib/verification.mjs; preserve conservative allocation dimensions and actual content overflow.
- [x] Add example-style regression and reconstruct the observed 6px scrollbar rules in examples/uulab-services/src/styles.css.
- [x] Recover interrupted work at ba02562433845de56d188bdf566aa1c0d125a07c instead of reimplementing it. Verify artifact 13120685467 SHA-256 5ebca223eb22fc6d0dc216229756a3b54103d454ad3676db8a2b8ec6aec78e33.
- [x] Review code and recovered run 41397382121: 324 toolkit/browser + 10 production checks passed; viewport/style checks 27 passed; each engine's existing interaction checks 38 passed. These are prior-run evidence, not a newly executed run.
- [x] Rerun local focused checks during recovery: 37 passed, 0 failed, 3 browser tests not run. This partial snapshot has no browser dependencies and is not a full checkout validation.
- [ ] Execute a fresh complete Actions regression and live comparison run after this recovery note.
- [ ] Cross-check new PNG/JSON evidence, document remaining differences and review limits, and integrate only the verified tree.

## Rulings
Existing continue instruction authorizes inline implementation and repository integration. Work is isolated in work/scrollbar-fidelity. Local container cannot resolve public hosts; partial text snapshots are for editing/unit checks only. Full build and source observation use the repository's Actions checkout, not a claim of a local full run.

The implementation already exists on the recovered branch. Finish its verification and handoff rather than creating duplicate CSS or replacing the main branch with an unreviewed snapshot.

Geometry tests use actual layout viewport edges rather than window edges when scrollbars reserve space. Header transform assertions allow only 0.001 CSS px numerical residue; screenshot thresholds are unchanged. Diagnostic immediate-load measurements and settled capture measurements are distinct states and must not be conflated. Code review in this session is self-review; no independent reviewer was dispatched.
