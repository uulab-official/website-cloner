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
- [ ] Run full Chromium gate and all-engine gate with zero skipped tests, inspect snapshots, record exact versions and counts.
- [ ] Review changed code, publish documentation and verified changes to main using a checked fast-forward lease.

## Execution ledger
- Remote base d347b6b verified. Local working directory is an isolated partial text snapshot from the prior Actions artifact at 4efb59a; subsequent base commit is documentation-only.
- Ruling: retain capture/verify as Chromium-only and add a separate demo regression command rather than claiming multi-engine source fidelity from target-only tests.
- Local network DNS cannot reach GitHub; full checkout, pinned dependency installation and browser executions run in repository Actions.
- New selector/report tests: local 32 failures before implementation, then 32 passes. Added process-environment/log and output guard checks. Existing suite-related tests remain green (140 total at this point).
- Output review found that an evidence directory inside dist/demo could be overwritten by the build. Six regression cases failed before adding canonical path overlap protection; all pass afterward.
- First remote code revision: b504687edf02b4903b769bb7591e34aa49674102; includes no application CSS/JS changes. Chromium/Firefox 38/38; WebKit 36/38. The two failures are equivalent outline shorthand strings in a different property order, not a different color, width, style, offset, or shadow. Compare the same CSS longhands without reducing assertions.
