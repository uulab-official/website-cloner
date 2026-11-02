# Scroll progress fidelity implementation plan

> **For agentic workers:** use superpowers:executing-plans task by task.

**Goal:** restore the observed scroll indicator and 24px back-to-top geometry, with fresh full-page evidence.
**Architecture:** extend authored render/CSS and the existing rAF update path; no new dependencies or paid service.
**Tech Stack:** Node ESM, Vite, Playwright; retain package-lock.json.
**Spec:** ../specs/2026-11-02-scroll-progress.md

## Global constraints
Keep /services/ and / alias, content and deliberate readable-menu/footer differences. Only authorized read-only source observation. Preserve raw and tolerance-filtered metrics and all thresholds. Use npm run check as the full gate.

## Tasks
- [x] Observe public source and unchanged production clone at 390/768/769/1440px; record computed geometry, scroll positions and footer cause. Baseline commit 3c5f683.
- [x] Task 1: add tests/demo-progress.test.mjs for top/middle/bottom, resized viewport, FAQ/content resize, short documents, pageshow, no-JS, missing ResizeObserver, reduced motion, keyboard return, and offsets across 320/390/768/769/1440. Full check at 385779c: 227 tests, 216 pass, 11 expected assertion failures, no skipped/cancelled tests. Eight missing-progress assertions and three mobile 20px-vs-24px assertions fail before implementation.
- [x] Task 2: modify examples/uulab-services/src/render.js, styles.css and main.js. Add [data-scroll-progress], 4px fixed gradient with scaleX, shared scheduling and resize observations. Remove only the 20px mobile back-to-top override. Full check at 4efb59a: 227 toolkit/browser + 9 production demo = 236 pass; zero failures/skips/cancellations; skill validation and production build pass.
- [x] Task 3: run progress-fidelity.yml again; inspect both FAQ screenshots and full-page JSON; crosscheck 10 exact counts/masks and 2 compatible full-page counts. Write case study and final self-review. Integration uses a non-force ref update with an expected head after verifying the documentation-only follow-up.

## Review focus
Resize events without scroll, FAQ height changes, zero scroll range, no-JS/fallback browser paths, restored pageshow event state, and unchanged header/menu keyboard access. Tests cover all named paths. Full-page differences and source drift are diagnostics, not hidden or resized-away failures.

## Ledger
Isolated task branch work/progress-controls-fidelity and local review snapshot. No subagent tool; final review is a separate author self-review, not an independent review.
Task 1 complete: run 41375444585 records RED with 11 intended failures. Desktop button geometry already passes and is not claimed as a reproduced defect.
Task 2 complete: run 41375861403 full check 236/236; general CI 41375861410 succeeds. Production diff: main.js +18/-2, render.js +1, styles.css +2/-1. No dependencies or threshold changes.
Task 3 evidence complete: six cases/ten viewports captured afresh; FAQ filtered difference becomes zero but exact differences remain; eight non-FAQ clone viewport PNGs are byte-identical before/after. Full-page 390px mismatch remains exit1/reviewRequired.
Ruling: initialize a mathematically correct zero rather than copy the source startup full-bar bug; initial computed style differs but normalized top capture does not regress.
Ruling: retain readable footer wrapping and 8px row gap; mobile full-page mismatch remains expected and explicitly reported, not a visual pass.
Ruling: use the existing scheduler and ResizeObserver rather than a CSS timeline; no added compatibility path, but arbitrary DOM growth without ResizeObserver is not comprehensively observed beyond the documented fallback events.
Final review: self-review (no subagent tool). Reviewed actual diff, rendered source/target geometry, tests/logs, expected dimension failure handling, no-JS and keyboard paths, rAF/observer scheduling, and artifact contents. No remaining Critical/Important finding identified in this change.
Final minor (deferred): existing Vite outDir warning and Actions v4 runtime warning are unchanged; migration is outside this focused fidelity patch.
