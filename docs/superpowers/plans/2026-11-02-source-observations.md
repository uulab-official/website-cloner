# Source Observations Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Execute in the isolated source snapshot and work/source-observations branch.

**Goal:** Convert source capture evidence into a reusable offline inspection report and asset candidates.
**Architecture:** Read and validate a bounded capture bundle, derive per-viewport observations without inference, render escaped static HTML and portable JSON in a new directory.
**Tech Stack:** Existing Node.js 22.12+ ES modules, node:test, existing CLI helpers; no new packages.
**Spec:** docs/superpowers/specs/2026-11-02-source-observations.md

## Global constraints
No overwrites, no source downloads, no browser required for offline analysis, no changes to existing demo or lockfile. Rights and functional parity stay unknown/unverified.

## Review focus
- Partial or foreign capture records must fail before output creation.
- Responsive image variants and repeated images must not be conflated.
- Source strings must not produce active report markup.
- Symlink/ancestor/descendant output paths must not change inputs/code.
- Truncated inventories and browser errors must be conspicuous rather than called complete.

## Tasks
- [x] Write CLI/fixture tests and run RED before implementation.
- [x] Implement scripts/lib/observations.mjs and scripts/observe.mjs; verify GREEN.
- [x] Add real capture-to-observe pipeline test for three engines and broken source handling; reuse existing capture unchanged.
- [x] Document init -> capture -> observe -> implement -> verify; wire npm script and opt-in live workflow.
- [ ] Run full checkout gate, three-engine pipeline, fresh owned-source capture, review actual HTML and JSON evidence.
- [ ] Review diff, record limitations, fast-forward main after checks and verify final CI.

## Execution ledger
Local offline tests: first 40 failures / 1 pass; then 41/41 passed. Added contradictory HTTP/action and settling checks: 4 expected failures, then 45/45 passed. Local optional pipeline tests not executed (browser npm dependency unavailable); complete checkout verification runs separately in Actions. A 400-character URL produced document width 3746 at viewport 390 before wrapping; after the CSS fix document width is 390. Long URL coverage is included in the browser pipeline test. An older owned-source capture was summarized locally for exploratory review; that is not a fresh live run.
