# Exact pixel evidence implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** Prevent tolerant zero from being mistaken for identical decoded pixels.
**Architecture:** A dependency-free RGBA measurement/validation helper, additive compare output and propagated report diagnostics.
**Tech Stack:** Existing Node ESM, pinned pngjs/pixelmatch/Playwright; no dependency changes.
**Spec:** `docs/superpowers/specs/2026-11-02-exact-pixel-evidence.md`

## Global constraints
- Preserve pixelmatch threshold 0.1, includeAA=false and current max-diff-ratio semantics.
- No source resizing, production bundles, source changes, forms, paid services or font redistribution.
- Optional metrics absent on historical reports mean not measured; invalid provided metrics fail.
- Full `npm run check` is required before main integration. Current local snapshot cannot substitute for a full checkout.

## Review focus
Alpha/invisible RGB, byte-array views and output aliasing, input-size safety, malformed count/ratio/bounds, old report and missing-artifact compatibility.

## Task 1: Exact comparison and regressions
- [x] Add tests for same/different/low-contrast/transparent RGBA, input validation, masks, and preservation of tolerant gate.
- [x] Observe failures against baseline.
- [x] Add `scripts/lib/exact-pixels.mjs`: measureExactPixels(source,target,width,height,mask?) and validateExactPixels(value,width,height).
- [x] Extend `scripts/compare.mjs` JSON/CLI; reuse diff buffer for exact mask after saving tolerant image.
- [x] Run tests and inspect small real PNG cases.

## Task 2: Report propagation and evidence
- [x] Add paired/suite legacy, malformed metrics, zero-tolerance warning and required-mask tests; observe baseline failures.
- [x] Update `scripts/lib/verification.mjs` and `scripts/lib/suite-runner.mjs`, preserving old-report behavior.
- [x] Full CI + fresh live suite, inspect produced images/HTML/JSON and snapshot missing-mask failure.
- [x] Self-review (no subagent tool); document measurements, limitations and safe main fast-forward.

## Execution record

- Base: 8283243. Local baseline selected files verified by Git blob hashes.
- Ruling: preserve tolerant pass gates; add decoded RGBA diagnostics, not an exact pass threshold. Cost: two metrics require explicit interpretation.
- Ruling: leave FAQ/header and intentional opaque menu styles unchanged in this increment; do not confuse diagnostics with fidelity improvements.
- RED: 25 local core/report assertions; additional missing-mask assertion; four real PNG tests in remote run 41366727224.
- GREEN: 144 related local checks; full checkout run 41367233245: 204 toolkit/browser + 9 production tests, no skips/failures, successful build.
- Fresh authorized source/target suite: six cases, ten viewport conditions, all completed; tolerant-zero ambiguity produced reviewRequired on one case.
- Fixed fixture packaging to include the new shared module after three existing isolated CLI tests reproduced missing-module failures.
- Final self-review: validated parsing, array bounds/aliasing, alpha/invisible RGB, legacy reports, malformed metrics, escaping and artifact requirements. No independent reviewer tool was available.
- Pillow/NumPy cross-check matched all ten viewport measurements and masks; not a fresh browser run or independent code review.
- Existing Vite/Actions warnings and cross-browser/device coverage remain deferred. Main integration uses a lease and final CI; the companion case study records the verified code revision separately.
