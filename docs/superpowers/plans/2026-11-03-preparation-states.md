# Stateful source preparation implementation plan

> **For agentic workers:** Use superpowers:executing-plans, task by task.

**Goal:** Prepare an observed menu/FAQ/theme state and carry its exact action configuration into later paired verification.
**Architecture:** A preparation-state helper owns offline validation, immutable action snapshots, relative suite mapping and action evidence checks. Existing capture and observe remain unchanged.
**Tech Stack:** Node.js 22.12+, existing Playwright and node:test; no new dependencies.
**Spec:** ../specs/2026-11-03-preparation-states.md

## Constraints and review focus

Keep default initialization files byte-identical. Preserve rights ledger and unverified status. Validate oversized/invalid action JSON before writes, never execute target actions during preparation, reject capture/action mismatches despite exit 0, preserve shared/overridden action intent across moving the workspace, and keep source strings out of executable HTML/instructions.

## Task 1 — configuration and capture contract

- [x] Add failing tests in tests/prepare-state.test.mjs for validation, snapshots, source-only execution, target mapping and mismatched evidence.
- [x] Add scripts/lib/preparation-state.mjs; integrate scripts/lib/prepare-project.mjs and scripts/prepare-clone.mjs.
- [x] Ruling: retain the old incomplete `--actions x` CLI test: required source/target/out are still missing, so it remains valid. New CLI tests cover the now-supported complete invocation.
- [x] Run new tests and existing offline preparation/init/observation tests.

## Task 2 — rendered pipeline and documentation

- [x] Add tests/prepare-state-pipeline.test.mjs for successful menu/FAQ/theme actions and missing-selector failure, source-only visits, and verify:suite with different target selectors.
- [x] Run complete npm run check and the new pipeline in Chromium/Firefox/WebKit on a complete checkout in GitHub Actions.
- [x] Run owned-source menu/FAQ preparation; keep raw images and journals, no new clone claim.
- [x] Update docs/prepare-clone.md and record actual results/remaining limitations.
- [x] Review diff and inspect generated images. Integrate verified code into main and record final CI status in the downloadable evidence; do not infer it from branch CI.

## Execution ledger

Working in an isolated container snapshot and a dedicated remote branch. Container DNS is unavailable; local snapshot omits fonts and some nontext assets. Local offline tests are not the full gate. Full verification uses the repository checkout in Actions. Existing user direction authorizes continued implementation and repository integration without additional approval prompts.

Local evidence: initial 30 tests were 26 FAIL / 4 PASS; after implementation 81 preparation tests passed. Canonical JSON byte-limit regression was corrected to a valid boundary fixture, then failed for missing rejection, then passed after the cap fix. Final selected offline regression set: 174 PASS, zero failed/skipped. Standalone skill validation and syntax/diff checks passed. Actions 41549843691 completed successfully for 6719694: full gate 584 PASS; separate new state run 38 PASS across Chromium, Firefox, WebKit. Owned source dark menu and FAQ prepared in three views. Five successful bundles and three expected failures cross-checked; 60 PNGs decoded. Independent review unavailable; author reviewed inputs, snapshots, suite mapping, capture contract and actual screenshots. Final main CI status is recorded in the downloadable evidence rather than recursively editing this commit.
