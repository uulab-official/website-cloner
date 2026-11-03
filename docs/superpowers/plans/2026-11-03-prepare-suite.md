# Prepare Suite Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans task-by-task; no subagent tool is available in this session.

**Goal:** Prepare multiple explicitly selected source pages/states and a portable future-verification manifest.
**Architecture:** Validate and snapshot the entire manifest before side effects; call existing prepareProject sequentially and aggregate its evidence. Keep capture and verifier deadlines separate.
**Tech Stack:** Node.js >=22.12, ESM, existing Playwright and node:test; no added packages.
**Spec:** docs/superpowers/specs/2026-11-03-prepare-suite.md

## Global Constraints

- Preserve example HTML/CSS/JS, assets, lockfile, standalone skill and pixel comparison.
- New destination only; no automatic target visit, shell command, crawl or success approval.
- Retain every planned case and explicit not_run entries; actions fixed before capture.

## Review Focus

1. A later case's malformed/mutated action file must not cause earlier network side effects or change frozen intent.
2. Canonical/symlink/ancestor output paths must not overwrite inputs or toolkit files.
3. Cancellation must stop queued cases regardless of fail-fast; incomplete journals are not success.
4. Long/hostile labels and error strings must remain inert and readable at mobile widths.
5. Future verifier thresholds, timeoutMs, target routes and selector overrides must survive relocation.

## Tasks

- [ ] Task 1: Add offline tests in tests/prepare-suite.test.mjs; verify RED; implement scripts/lib/prepare-suite.mjs and scripts/lib/preparation-suite-report.mjs. API: prepareSuite(options, {execute?}) uses existing capture executor seam only. Verify full offline related suite.
- [ ] Task 2: Add scripts/prepare-suite.mjs CLI and package.json command; test help, preflight, bad input, fail-fast and zero/nonzero exits. Add docs/prepare-suite.md and docs/README.md links.
- [ ] Task 3: Add tests/prepare-suite-pipeline.test.mjs and .github/workflows/prepare-suite.yml; run complete check, three-engine fixture pipeline and owned-source batch. Review artifact reports and logs, record exact evidence.
- [ ] Task 4: Self-review entire diff, document limitations, integrate verified changes into requested main without force, confirm final CI status.

## Execution ledger

- Work is in an isolated text snapshot from prior verified artifact 6719694. Remote main 404312e was freshly confirmed. DNS prevents local clone/dependency install. Local evidence is never labeled full checkout verification; use complete Actions checkout for full gate.
- Ruling: reuse verification schema rather than inventing another config; preparer capture timeout is a CLI option, while per-case timeoutMs stays a future verifier deadline.
- Ruling: no new crawling or target execution; explicit source cases only. Existing user repeatedly requested repository continuation and main integration.
