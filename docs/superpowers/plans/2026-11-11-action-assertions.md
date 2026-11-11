# Explicit UI State Assertions Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans, task by task.

**Goal:** Reject captures where a click succeeds but an explicitly expected UI state does not.
**Architecture:** Shared node-only action contract, read-only Playwright assertion runner, existing capture pipeline and report validation.
**Tech Stack:** Node.js >=22.12, current pinned Playwright; no dependencies added.
**Spec:** docs/superpowers/specs/2026-11-11-action-assertions.md

## Global Constraints
- Keep existing click/scroll input and all authored example files unchanged.
- Require one attached element for every assertion; exact attribute string matching; bounded deadline 1..10000 ms.
- Preserve assertion fields in portable copies and expected/observed evidence.
- No semantic parity claim, source requests only through explicitly requested capture.

## Review Focus
- Hidden checks against nonexistent or duplicate selectors must not pass.
- Delayed state updates must retry; unchanged UI must fail within deadline.
- Snapshot normalization cannot silently discard expected attribute/value/deadline.
- Forged success with missing or contradictory observed values must fail downstream.
- Invalid later action inputs must fail before output mutation or browser launch.

## Tasks
- [ ] Contract RED: tests through existing preparation/suite/evidence APIs.
- [ ] Implement shared contract; wire all preflight and snapshot/evidence validation.
- [ ] Runner RED: real-browser tests for correct/delayed/no-op/missing/ambiguous state; implement read-only checks and diagnostic persistence.
- [ ] Exercise portable preparation, moved-folder verification, and deliberately broken target with identical pixels in three engines.
- [ ] Document usage; run full repository CI, new engine tests and owned-source example; review diff and verify main after integration.

## Execution ledger
- Local workspace is a separate artifact snapshot from f8da8ad. Remote comparison confirms main 9f9496e changes documentation only. Browser/npm execution is delegated to the repository's Actions environment because local DNS cannot resolve GitHub. No claim of a complete local checkout.
