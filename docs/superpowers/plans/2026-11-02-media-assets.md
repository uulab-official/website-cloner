# Media asset observations implementation plan

> **For agentic workers:** Use superpowers:executing-plans, task by task.

**Goal:** Preserve CSS backgrounds and video/audio references in capture-to-observe handoffs.
**Architecture:** A self-contained read-only browser collector writes optional visualAssets v1. A pure offline normalizer validates that extension, parses CSS URL expressions and merges candidates into the existing ledger. Existing CLI/output guards are reused.
**Tech Stack:** Node.js 22.12+, existing Playwright, node:test; no dependency changes.
**Spec:** docs/superpowers/specs/2026-11-02-media-assets.md

## Constraints and review focus
- Preserve existing commands, screenshots, rights defaults and original source code.
- Treat CSS/URLs/text as data; never insert untrusted strings in active HTML/CSS.
- Test escapes, gradients, image-set, malformed/truncated CSS and unsafe URL schemes.
- Test old bundles and contradictory new extension fields; never equate absent evidence with no assets.
- Test duplicate image/background/poster URLs and selected versus declared media references.
- Bound DOM scans, result arrays and strings; expose coverage gaps.

## Tasks
- [x] Write failing offline parser/normalizer/merge tests and real three-engine pipeline tests.
- [x] Implement collector, parser/normalizer, capture integration and ledger/report integration.
- [ ] Run offline tests; run full check and three-engine media pipeline in complete Actions checkout.
- [ ] Observe owned live source, inspect report and cross-check ledger against capture evidence.
- [ ] Self-review, document limits, publish verified branch to requested main without force.

## Execution ledger
- Remote baseline main: fac53ee9b3643f2977e9f4ce9a548bfb6ee9034a.
- Local source is a text-only review snapshot from the preceding implementation artifact 01c3677, not a full checkout. Main's intervening changes are documentation only. Modified existing file blob hashes were checked against main. Full CI must run remotely; no claim of local full-suite coverage.
- Ruling: continue the existing approved repository scope without a new approval loop; optional asset discovery, not automatic download or app generation.
- Local RED: parser/normalizer 29 failures and 14 negative-test passes; collector/space regression 4 failures; integration 3 failures. Local GREEN: new plus existing offline observation regressions 99/99, no skipped tests.
