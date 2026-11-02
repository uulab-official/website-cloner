# Scrollbar Fidelity Implementation Plan

> For agentic workers: execute inline using superpowers:executing-plans and test-driven-development.

**Goal:** Separate actual overflow from scrollbar space and reproduce stable source layout without altering source captures.
**Architecture:** Add layout viewport metadata to the DOM collector and pair assessment. Reconstruct observed scrollbar rules in both example HTML entrypoints before external stylesheets load.
**Tech Stack:** Node 22.12+, locked Playwright, existing Vite example.
**Spec:** ../specs/2026-11-02-scrollbar-fidelity.md

## Constraints
No dependency, lockfile or pixel threshold changes. No original-site edits or submissions. Preserve output protection, conservative screenshot allocation bounds, legacy evidence readability and true overflow detection. Diagnostic overrides remain separate from live captures.

## Completed tasks
- [x] Recover ba02562 and inspect source, changes, test history and earlier evidence instead of duplicating work.
- [x] Reproduce 13 focused viewport/assessment failures against old code, then observe recovered code passing. Local snapshots are partial and browser-unavailable, not full-build proof.
- [x] Repeat the full pipeline at f999493; do not merge after live evidence reveals intermittent WebKit layout widths despite passing tests.
- [x] Isolate CSS arrival ordering in 24 diagnostic production contexts: baseline 0/8, early identical rules 8/8, overflow-only 0/8.
- [x] Observe two assertion failures before early-style implementation in run 41417174235, including HTTP WebKit 390 versus 384.
- [x] Correct root-only b3cfa after the production gate identifies the missing /services/ HTML entry. Add both-entry static and real HTTP delayed-style/FAQ/reload coverage.
- [x] Verify final 1a690453e195f4dae2c6dc9ad6fb5ac45cbc4e81 in run 41419109262: full 337 pass; targeted three-engine 32 pass; repeated example checks 38 per engine pass; production baseline 8/8; 30 live pairs completed with matching layout widths.
- [x] Recalculate all 30 RGBA metrics/masks independently, inspect real desktop/mobile WebKit FAQ images, compare source hashes and byte-identical Chromium/Firefox implementation images.
- [x] Record results, remaining differences, self-review and replay instructions. Prepare documentation-only integration on the verified tree; main ref/CI confirmation is recorded separately at integration time.

## Review focus and rulings
True body overflow, classic/overlay scrollbars, malformed/missing geometry, small viewport menu access, both authored HTML paths and delayed CSS are covered. Geometry assertions allow only 0.001 CSS px transform residue, not relaxed screenshot thresholds. Old figures are never relabeled as fresh.

The continue instruction authorizes scoped repository integration. Work remains isolated until checks pass; never force a changed main. The local container cannot resolve public hosts or run browser dependencies, so full checks use the repository Actions checkout. Code review is implementer self-review, not independent review. The small inline style block is intentionally mirrored across two HTML entries and tested on both; restrictive host CSP needs adaptation.

The final documentation commit does not modify tested application/tool/test/workflow/dependency files. See the case-study evidence JSON for run IDs, hashes and verification limits.
