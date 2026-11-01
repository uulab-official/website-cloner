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
- [ ] 3. Add usage docs and opt-in live workflow. Run full npm run check in GitHub Actions and an actual UULab live comparison. Inspect artifacts and retain failure evidence.
- [ ] 4. Review changes, publish verified commit, record run-specific outcomes and remaining limitations.

## Execution notes
This container has no GitHub DNS/network access. Local pure Node tests run here; full dependency/browser verification runs on the repository runner. GitHub changes use a dedicated branch and atomic Git tree updates. No independent subagent tool is present: final review will be self-review.

Local verification: 26 passed, 0 failed, 2 browser-dependent tests skipped pending the full CI gate. Production code was preceded by failing tests; top-level HTML failure visibility also has a RED-to-GREEN regression test.
