# Cross-browser example verification implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline; check each result before marking complete.

**Goal:** Reproduce example behavior in three engines rather than claim non-Chromium support from one engine.
**Architecture:** A strict engine selector shared by the four existing demo test files; a bounded sequential test runner reuses process-tree termination and output-directory protections. A script-free report and opt-in production snapshots preserve failures and engine provenance. Normal CLI capture remains Chromium-only.
**Tech Stack:** Node.js 22.12+, existing pinned Playwright, node:test, GitHub Actions.
**Spec:** docs/superpowers/specs/2026-11-02-cross-browser.md

## Constraints and review focus
- No dependency or visual threshold changes; never overwrite unrelated work.
- Reject unknown/duplicate engines and non-Chromium executable overrides before output changes.
- A zero exit without complete TAP totals and consistent engine/version is failure.
- Do not skip non-Chromium failures or normalize away geometry/function bugs.
- No JS, reduced motion, native focus semantics, and asynchronously delivered scroll events need direct inspection.
- Linux WebKit is not branded Safari or real iOS; snapshots are implementation-only evidence.

## Tasks
- [x] Add failing selector, result-validation and command preflight tests; run them locally.
- [x] Implement selector + helper and opt-in sequential runner; verify unit tests.
- [x] Run existing behavior checks and production captures for all engines in an isolated branch; investigate actual failures before any fix.
- [x] Run full Chromium gate and all-engine gate with zero skipped tests, inspect snapshots, record exact versions and counts.
- [x] Review changed code and prepare result documentation. Publish by checked fast-forward; final branch ref and CI run are the publication evidence.

## Execution ledger
- Remote base d347b6b verified. Local working directory is an isolated partial text snapshot from the prior Actions artifact at 4efb59a; subsequent base commit is documentation-only.
- Ruling: retain capture/verify as Chromium-only and add a separate demo regression command rather than claiming multi-engine source fidelity from target-only tests.
- Local network DNS cannot reach GitHub; full checkout, pinned dependency installation and browser executions run in repository Actions.
- New selector/report tests: local 32 failures before implementation, then 32 passes. Added process-environment/log and output guard checks. Existing suite-related tests remain green (140 total).
- Output review found that an evidence directory inside dist/demo could overlap the build. Six regression cases failed before adding canonical path overlap protection; all pass afterward.
- First remote revision b504687edf02b4903b769bb7591e34aa49674102: Chromium/Firefox 38/38; WebKit 36/38. Two failures are equivalent outline shorthand strings in different property order. Compared identical CSS longhands and retained offset/shadow assertions, without modifying application styles.
- Final code 1857daf70c44fc41f6ebccce183a786c0ef21d6c: run 41379115705 passed 268 toolkit + 10 production-demo tests and 38/38 in each engine. No failures, skips, cancellation or todo. Normal CI 41379115710 also passed.
- Verified artifact SHA-256 and all 21 PNG dimensions/state records; remote authored code snapshot matches local files. Final local related tests 140/140 pass. Reviewer was the author; no independent review was available.
- Ruling: preserve engine-native rendering and record target-only screenshots; do not imply cross-engine pixel parity, Safari/iPhone certification, or fresh live-source verification.
- Result and remaining gaps: docs/case-studies/uulab-services/browser-compatibility-2026-11-02.md.
