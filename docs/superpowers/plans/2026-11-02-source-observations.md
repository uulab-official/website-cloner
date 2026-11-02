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
- [x] Run full checkout gate, three-engine pipeline, fresh owned-source capture, review actual HTML and JSON evidence.
- [x] Review diff and record limits, test counts, input provenance and data crosscheck in docs/source-observations-verification-2026-11-02.md.

## Execution ledger
Local offline tests: first 40 failures / 1 pass; then 41/41 passed. Added contradictory HTTP/action and settling checks: 4 expected failures, then 45/45 passed. A serialization-wide warning check misclassified failed:0: reproduced with one failing regression, then corrected to exact status values and positive failure/pending-image counts. Final 47/47 offline tests passed.

A 400-character URL produced document width 3746 at viewport 390 before wrapping; after the CSS fix document width is 390. Long URL coverage is included in the browser pipeline test. Local optional pipeline tests were not executed (npm browser dependency unavailable). An older owned-source capture was summarized locally for exploratory review; that was not a fresh live run.

The full Actions checkout at 01c3677de45b6faada7730f527f6417653989923 completed successfully in run 41450037111, job 125292688187: npm run check 423+7+10=440 passed, dedicated offline/three-engine pipeline 53 passed, no failures/cancellations/skips/todo. Fresh source capture completed at 2026-11-02T13:08:10.731Z. Generated observations had 3 views, 4 unique image URLs, 15 image observations and no diagnostic warnings, while reviewRequired stayed true. Six PNGs, ten input hashes and derived records matched a separate Python/Pillow check. Ten reviewed source/config/test/guide files matched the downloaded CI snapshot byte for byte. This was author self-review, not an independent reviewer.

Integration policy: fast-forward main only from the freshly rechecked base ref using expected_sha and force=false. Publish only the verified implementation plus these documentation updates. Record the final commit and its CI state from the actual GitHub ref/runs, not from this pre-integration plan.
