# FAQ scroll fidelity — completed implementation record

Goal: close the recorded FAQ header/focus discrepancy in the editable example without weakening keyboard access or pixel metrics.

Spec: the remaining FAQ discrepancy in `docs/case-studies/uulab-services/exact-pixels-2026-11-02.md`, followed by fresh source observations recorded in `scroll-fidelity-2026-11-02.md`.

Architecture: existing Node ESM/Vite authored example; preserve static/no-JS content and exact dependencies. Keep live owner-site observation separate from normal local-fixture CI. No copied production bundles, submissions, paid services, or image-threshold changes.

- [x] Observe source/target header geometry at top, down/up scroll, FAQ pointer/keyboard activation and header focus at 390/1440px. Correct the initial source-selector error using the existing observed shared selector.
- [x] Reproduce five header assertion failures on the old implementation. Fix the separate no-JS RAF wait error in the test harness. Observe two additional pointer-ring assertions fail locally before the ring fix.
- [x] Modify `src/main.js`: 100px threshold, direction tracking, duplicate-event stability, focus/open-menu pinning, and page restoration reset.
- [x] Modify `src/styles.css`: translate hiding, immediate focus reveal, 300ms transition with existing reduced-motion override, pointer/keyboard FAQ ring.
- [x] Add ten real-browser regressions in `tests/demo-scroll.test.mjs`. Local setContent runner passes ten; canonical full Actions gate passes 214 + 9 = 223, no failures/cancellations/skips.
- [x] Fresh six-case/ten-view live comparison; inspect desktop/mobile FAQ PNGs. Recompute twenty before/after exact ratios and confirm all eight non-FAQ target PNGs are unchanged.
- [x] Self-review all changed files and publish reproducible evidence before a leased integration into main.

Review focus: threshold boundary, equal-position scroll events, hidden focused controls, open-menu/Escape behavior, no-JS and changed motion preference. These are directly covered by the new tests. Pixel thresholds and existing DOM structure remain unchanged.

Rulings: keep the prior opaque menu and footer wrapping rather than chase a zero ratio; protect focused controls and open menus from hiding; retain live diagnostics after a failed regression step without suppressing that failure. Cost: intentional visual differences and a separate opt-in live-network workflow remain.

Final review: author self-review, no independent reviewer. No unresolved critical finding in the changed scope. Deferred visual polish: source progress strip, mobile back-to-top position, and previously documented full-page/intentional differences. Deferred platforms: real devices, Safari/Firefox and non-Linux runners. Existing build/Actions warnings remain documented.

Code tested: `db9b8aa3d1ee19a37c6d00b0534556fb6caf4ef1`; report-only follow-up does not modify the verified implementation.
