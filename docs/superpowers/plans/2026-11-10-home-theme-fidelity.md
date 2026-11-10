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

- [ ] Capture baseline light/dark top, menu and question states with all engines; inspect computed source and target styles.
- [ ] Add failing deterministic tests for confirmed mismatches, observe RED, apply minimal scoped repair, observe GREEN.
- [ ] Run npm run check and check:browsers; repeat fresh same-engine source comparisons and inspect images.
- [ ] Record evidence and limitations, review the full diff, integrate only after verification and recheck final main CI.

## Ledger

- Latest main already contains the second actual homepage example. Do not redo that work.
- Local direct GitHub DNS is unavailable; a downloaded text snapshot is for inspection only. Complete browser/build validation runs in Actions checkout.
