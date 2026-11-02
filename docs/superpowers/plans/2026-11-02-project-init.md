# Project Init Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Start another authorized website reconstruction without hand-writing its evidence and verification bundle.
**Architecture:** Pure plan/render helpers reuse normalizeSuite. A separate exclusive writer and thin CLI do offline initialization; existing capture commands remain unchanged.
**Tech Stack:** Node.js >=22.12.0, ESM, node:test; existing pinned Playwright only for integration verification.
**Spec:** docs/superpowers/specs/2026-11-02-project-init.md

## Global Constraints
No new dependencies. No existing app changes. No network during initialization. No overwrite or automatic rights/verification claims. Keep the standalone skill usable without CLI scripts.

## Review Focus
- Raw URL normalization must not hide traversal, credentials or unsupported fragments.
- Query and markup-like data must not escape into executable shell or handoff instructions.
- Existing directories, symlink aliases and concurrent creation must not overwrite data.
- Generated configuration must load in the current suite CLI, not just parse as JSON.
- Browser fixtures and real source captures must be explicitly distinguished.

## Task 1: Offline plan and exclusive bundle creation
- [x] Add tests/init.test.mjs for defaults, invalid inputs, filesystem safety and dry-run compatibility; observe RED.
- [x] Add scripts/lib/project-init.mjs and scripts/init.mjs; observe GREEN with the same tests.
- [ ] Add the npm init command and docs/project-init.md; link from current README.

## Task 2: End-to-end generated suite and integration
- [x] Add real HTTP fixture test with generated suite; assert actual PNGs, engine and failure preservation.
- [ ] Run full npm run check and existing check:browsers in a full GitHub Actions checkout.
- [ ] Self-review the diff and evidence; document exact limitations and only integrate verified code.

## Execution ledger
- Isolated local text snapshot from prior verified artifact; full source/assets and fixed dependencies will be verified in Actions, not inferred from the snapshot.
- Ruling: continue without another approval round, as requested repeatedly. Keep the existing toolkit, preserve authored apps, and deliver a bounded initialization feature.
- RED: 44 tests, 43 failed and 1 passed before the feature existed; GREEN: 44 passed, no failures/skips. Related local regression: 214 passed, 2 browser tests unrun due to unavailable local dependencies.
