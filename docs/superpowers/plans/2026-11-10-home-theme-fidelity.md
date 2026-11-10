# Homepage Theme Fidelity Implementation Plan

> For agentic workers: use superpowers:executing-plans inline. Preserve existing work and verify every claim.

**Goal:** Repair observed homepage dark-theme fidelity gaps and verify the existing page with three engines.

**Architecture:** Reuse capture/verify:suite and the existing Vite example. Scope styles to .home-page. Keep deterministic tests independent of the live source; source comparison is opt-in.

**Tech Stack:** Node >=22.12.0, existing locked Playwright/Vite versions, authored HTML/CSS/JS.

**Spec:** ../specs/2026-11-10-home-theme-fidelity.md

## Global Constraints

- Base main: 9ea7c49c5572025748972b708ff6f438493650c4; work/home-theme-fidelity is the isolated remote branch.
- Preserve / and /services/, dependencies, assets, licenses and comparison thresholds.
- Never treat a dark preference or a successful build as proof of active-theme fidelity.
- No font files in shared evidence.

## Review Focus

- Active theme after a user toggle, not only a media preference.
- Descendant foreground/background overrides and card contrast.
- Light-theme and service-route regressions from shared CSS.
- Responsive geometry and native controls across engines.
- Live content drift and intentional differences remain visible.

## Tasks

- [x] Capture baseline light/dark top, menu and question states with all engines; inspect computed source and target styles.
- [x] Add failing deterministic tests for confirmed mismatches, observe RED, apply minimal scoped repair, observe GREEN.
- [x] Run npm run check and check:browsers; repeat fresh same-engine source comparisons and inspect images.
- [x] Record evidence and limitations; review the full implementation diff.
- [ ] Integrate verified code and documentation, then check final main CI. This final integration check is recorded in the delivered evidence, not inferred from the branch result.

## Ledger

- Latest main already contains the second actual homepage example. Do not redo that work.
- Local inspection is a partial artifact snapshot using a preinstalled driver, not the locked full checkout. Complete validation runs in Actions.
- Source measurement: actual toggled dark page, Chromium probe run 42765324597, two widths, 40 measured contracts.
- RED: style tests 8 failed / 4 passed; GREEN 12/12. New suite configuration 4/4; related local tests are separately scoped.
- Full gate: 641 + 7 + 10 = 658 passing; same behavior checks 62/62 in each of three engines; feature run 42767392135 succeeded.
- Live comparisons: 72 before/after view pairs. Exact RGBA recomputed independently for all 72. Light target PNGs 18/18 unchanged; source PNGs 33/36 unchanged.
- Ruling: split browser installation into bounded matrix jobs after Ubuntu package download stalls cancelled the first diagnostic run; preserve that failure record.
- Ruling: leave intentional opaque menu/readable moon and remaining full-height differences visible; no image resizing or changed thresholds.
- Author self-review only; no independent reviewer. Full-page dimension evidence is recorded, not a new full-page pixel comparison.
- Integration gate: verified implementation f8da8ad. The ensuing documentation commit must not change runtime code. Final main CI is checked after integration.
