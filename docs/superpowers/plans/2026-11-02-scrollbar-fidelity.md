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
- [x] Inspect current main, previous evidence, code and baseline tests. Local related baseline: 52 pass / 2 browser tests not run.
- [x] Add arithmetic/assessment and real-engine regressions in tests/viewport-evidence.test.mjs. Before implementation: 13 failures / 4 pass / 2 browser tests not run.
- [ ] Observe source and implementation in three engines using scripts/case-studies/inspect-uulab-scrollbars.mjs; record causal diagnostic overrides separately.
- [ ] Update scripts/lib/page-evidence.mjs and scripts/lib/verification.mjs, run new tests and existing regression suite.
- [ ] Add example-style regression before implementing only observed scrollbar rules in examples/uulab-services/src/styles.css.
- [ ] Run npm run check, real-engine viewport tests, existing check:browsers and fresh paired suites; inspect actual images and compare immutable baseline.
- [ ] Record evidence, self-review limits, source changes if any, and remaining differences; integrate only verified code.

## Rulings
Existing continue instruction authorizes inline implementation and repository integration. Work is isolated in work/scrollbar-fidelity. Local container cannot resolve public hosts; partial text snapshots are for editing/unit checks only. Full build and source observation use the repository's Actions checkout, not a claim of a local full run.
