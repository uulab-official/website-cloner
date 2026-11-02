# Source Preparation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans task-by-task.

**Goal:** One opt-in command produces a source-evidenced implementation handoff.
**Architecture:** Reuse initializeProject, executeNodeScript/capture, readObservations/observeCapture. New orchestration and presentation only; no new browser collector or dependencies.
**Tech Stack:** Node ESM >=22.12.0, existing Playwright and node:test.
**Spec:** docs/superpowers/specs/2026-11-02-prepare-clone.md

## Global Constraints
- New destinations only. Never visit the target explicitly or run app/server commands.
- Keep init's five files byte-identical; observed candidates live separately.
- Never mark prepared evidence as verified implementation or authorized assets.
- Preserve failures and bounded logs; no new npm lifecycle hook or dependencies.

## Review Focus
- Existing/aliased/protected destinations and invalid options before side effects.
- Zero exit with absent or mismatched capture evidence.
- Timeouts/signals/process failures and partially created source/report directories.
- Untrusted HTML/URLs remain data; portable entry points have no active remote content.
- Width/engine/state matching and target-not-contacted real browser pipelines.

## Tasks
- [x] 1. Add tests/helpers/preparation-fixture.mjs and tests/prepare-project.test.mjs; record missing-feature failures.
- [x] 2. Implement scripts/lib/prepare-project.mjs and scripts/prepare-clone.mjs; add package script and pass offline tests.
- [x] 3. Add tests/prepare-pipeline.test.mjs for source 200/503, no target visits, portable local report; integrate docs/CI and run full gate plus three-engine/live-source execution.
- [x] 4. Review diff, inspect reports and preserve actual evidence. Verified implementation is ready for main integration; final main CI is recorded separately after the ref update.

## Execution ledger
- Base remote main: efdc068c4909c85ba920308f3af39c2d51d73c9e.
- Local workspace is a reviewable artifact snapshot without installed toolkit dependencies/full binary assets, not a complete GitHub checkout. Use Actions for the full gate.
- Ruling: expose prepare:clone, not prepare, to avoid running network capture at npm install/ci time.
- Ruling: implement inline and use self-review; no independent reviewer tool is available.
- Offline RED: 45/45 failed before implementation. GREEN: 45/45 passed; related dependency-free tests: 190/190 passed.
- Local full check attempted and failed with missing Playwright/PNG dependencies in the artifact snapshot (54 failures); full validation must use actual Actions checkout, not this partial result.
- Current guide is linked from docs/README.md; keep the existing root README unchanged.

- Final implementation b38b407bb6e3a2979a2dc4aa29e2f31f732dfa96: full Actions gate 533+7+10=550 passed; separate 51 preparation/recovery + 6 browser pipeline tests=57 passed, no failures/skips. Run 41460421801, job 125327719738.
- Self-review fix: record networkAccess before child launch; recovery RED 1/6 failed, GREEN 6/6; related offline final 196/196.
- Actual source-only prepare ran 2026-11-02 23:20:38–23:20:48 KST without a target server: 3 widths, 4 asset candidates, 0 warnings; implementation/comparison remain unverified.
- Cross-check: 4 prepared and 3 expected HTTP-error bundles, 13 input hashes, 18 PNG full decodes; reviewed 12 changed files match CI snapshot. See docs/prepare-clone-verification-2026-11-02.md.
