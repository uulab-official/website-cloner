# Paired Verification Implementation Plan

> For agentic workers: execute with superpowers:executing-plans; test each task before implementation.

**Goal:** Repeatable live-source versus editable-clone verification with inspectable evidence.
**Architecture:** Compose existing capture and compare subprocesses; assess structured metadata; render a script-free local report.
**Tech Stack:** Node ESM, existing Playwright/PNG tooling, GitHub Actions.
**Spec:** ../specs/2026-11-01-paired-verification-design.md

## Global constraints
No new dependencies; preserve existing example/skill. No hidden live network tests in normal CI. No source scripts as implementation. Preserve TLS verification and output-directory safety. Only publish to requested repository.

## Review focus
Missing/failed capture must never pass. Metadata mismatch must prevent pixel comparison. Arbitrary page text must not become HTML. An absent threshold is not a pass. Existing input files must survive invalid/overlapping outputs.

## Tasks
- [x] 1. Add pure assessment/report tests; observe RED; implement scripts/lib/verification.mjs; observe GREEN.
- [x] 2. Add CLI argument/output tests; observe RED; implement scripts/verify.mjs composing the existing tools; add paired fixture browser test to full check.
- [x] 3. Add usage docs and opt-in live workflow. Run full npm run check in GitHub Actions and an actual UULab live comparison. Inspect artifacts and retain evidence.
- [x] 4. Self-review changes; fix threshold metadata/label issues through three additional RED-to-GREEN tests; record run-specific outcomes and limitations.

## Execution notes
This container has no GitHub DNS/network access. Local pure Node tests run here; full dependency/browser verification runs on the repository runner. GitHub changes use a dedicated branch and atomic Git tree updates. No independent subagent tool is present: final review is self-review.

Local final patch tests: 29 passed, 0 failed, 2 browser-dependent tests skipped. The first feature commit `2df12d8` passed full CI run `41307322958` and live run `41307323047`. The subsequent reporting-only patch requires its own full CI run before main publication; consult the commit's Actions checks for that result rather than treating the earlier run as verification of later code.

Ruling: keep diagnostics as visible warnings rather than functional pass/fail; screenshot capture cannot prove interaction parity. Ruling: retain the existing intentional opaque narrow menu and footer wrapping, and document the source differences. Ruling: keep normal CI independent from the live source; source availability must not gate ordinary offline tests.
