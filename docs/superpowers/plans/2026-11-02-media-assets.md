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
- [x] Run offline tests; run full check and three-engine media pipeline in complete Actions checkout.
- [x] Observe owned live source, inspect report and cross-check ledger against capture evidence.
- [x] Self-review and document limits; prepare verified branch for requested main publication without force.

## Execution ledger
- Remote baseline main: fac53ee9b3643f2977e9f4ce9a548bfb6ee9034a.
- Local source is a text-only review snapshot from the preceding implementation artifact 01c3677, not a full checkout. Main's intervening changes are documentation only. Modified existing file blob hashes were checked against main. Full CI ran remotely; no claim of local full-suite coverage.
- Ruling: continue the existing approved repository scope without a new approval loop; optional asset discovery, not automatic download or app generation.
- Local initial RED: parser/normalizer 29 failures and 14 negative-test passes; collector/space regression 4 failures; integration 3 failures. Local GREEN: new plus existing offline observation regressions 99/99, no skipped tests.
- Review RED: 3 of 4 edge-case tests failed. Fixed same-document fragment false positives, invalid unquoted CSS newline and added 5000-reference cap with omission counters. Final offline tests 103/103.
- Final implementation 778d33b06adf651b680da296fdd5fb2da34039b7: Actions run 41455697073 passed full 497 tests and separate 59 new/three-engine tests; no failures/cancelled/skipped/todo. Standard CI 41455697001 also passed.
- Three engines each recorded 9 fixture URLs / 24 observations at two widths. Fresh owned source has gradients, no media, and 4 image URLs / 15 observations at three widths. No new clone or visual comparison claimed.
- Python/tinycss2/Pillow cross-check matched four bundles, 31 input hashes and 18 decoded screenshots. 13 reviewed files match downloaded CI source bytes. Desktop/mobile report images inspected; self-review only, not independent review.
- Full verification and remaining limits: docs/media-assets-verification-2026-11-02.md.
