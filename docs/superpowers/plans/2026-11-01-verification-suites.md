# Verification Suites Implementation Plan

> **For agentic workers:** use superpowers:executing-plans for this inline implementation.

**Goal:** Run and inspect named clone verification cases from one manifest.
**Architecture:** Strict pure normalization and assessment helpers, a coordinator invoking the existing verify CLI, script-free summary, and reusable UULab suite.
**Tech Stack:** Node.js 22.12+, existing Playwright/pixelmatch tooling; no dependency changes.
**Spec:** `docs/superpowers/specs/2026-11-01-verification-suites-design.md`

## Global Constraints

Keep existing capture/verify semantics; no functional parity claims. Local deterministic CI and separate opt-in live evidence. Never overwrite inputs or non-owned outputs. New network targets require user authorization. No shell interpolation.

## Review Focus

1. Unknown fields or stringly typed settings silently losing a threshold.
2. Missing/duplicate/mismatched result rows reported as success.
3. Malicious labels/URLs escaping the HTML report or case output paths.
4. Failed early cases preventing later evidence or causing stale results to pass.
5. Dry-run/overwrite accidentally modifying the manifest or unrelated directories.

## Task 1 — Manifest and result contracts

Files: scripts/lib/suite.mjs; tests/suite.test.mjs.
Interfaces: normalizeSuite(input, overrides), assessSuiteCase(spec, command, report, failOnWarnings), renderSuiteReport(report).
- [ ] Add tests for normalized defaults, overrides, strict validation, bounds, result integrity, warning policy and escaping.
- [ ] Run tests and observe feature-missing failures.
- [ ] Implement helpers and run the native Node test suite.

## Task 2 — CLI execution and reproducible evidence

Files: scripts/verify-suite.mjs; tests/suite-cli.test.mjs; tests/suite.e2e.mjs; package.json.
Interfaces: CLI --config FILE --out DIR [--only IDS] [--source-origin URL] [--target-origin URL] [--fail-on-warnings] [--dry-run] [--overwrite].
- [ ] Test dry-run, invalid input, owned-output protections and subprocess argument construction.
- [ ] Implement serial case execution, inline-action files, incremental HTML/JSON and retained diagnostics.
- [ ] Exercise real local HTTP fixtures through the actual capture/compare subprocesses; include a failed first case and a later successful case.

## Task 3 — Documentation, live run and publication

Files: docs/verification-suites.md; docs/case-studies/uulab-services/verification-suite.json; .github/workflows/ci.yml; .github/workflows/live-clone.yml.
- [ ] Document commands, defaults, gates and limits.
- [ ] Run npm run check and the new browser integration test in GitHub Actions.
- [ ] Run the live UULab suite separately; download and inspect evidence.
- [ ] Self-review (no subagent tool), record results and limitations, then fast-forward main only after verified checks and a fresh-head check.
