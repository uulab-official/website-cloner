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
- [ ] Task 1: add tests/demo-progress.test.mjs for top/middle/bottom, resized viewport, FAQ/content resize, short documents, pageshow, no-JS, missing ResizeObserver, reduced motion, keyboard return, and offsets across 320/390/768/769/1440. Run full check and confirm missing indicator/mobile offset assertions fail before changing product code.
- [ ] Task 2: modify examples/uulab-services/src/render.js, styles.css and main.js. Add [data-scroll-progress], 4px fixed gradient with scaleX, shared scheduling and resize observations. Remove only the 20px mobile back-to-top override. Run full check: zero failures/skips and successful production build.
- [ ] Task 3: run progress-fidelity.yml again, inspect screenshots and full-page JSON, compare before/after source hashes and exact metrics. Write case-study results and final self-review. Integrate only verified code using a non-force ref update with an expected head.

## Review focus
Resize events without scroll, FAQ height changes, zero scroll range, no-JS/fallback browser paths, restored pageshow state, and unchanged header/menu keyboard access. Tests cover all named paths. Full-page differences and source drift are diagnostics, not hidden or resized-away failures.

## Ledger
Isolated task branch work/progress-controls-fidelity and local review snapshot. No subagent tool; final review will be a separate author self-review.
Ruling: initialize a mathematically correct zero rather than copy the source startup full-bar bug; initial computed style may differ but normalized top capture must not regress.
Ruling: retain readable footer wrapping and 8px row gap; mobile full-page mismatch remains expected and explicitly reported, not a visual pass.
