# Homepage Clone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a second real editable clone, reachable at /home/, not another preparation wrapper.
**Architecture:** Keep the existing Vite multi-page example and shared chrome. Render the homepage at build time with separate content and scoped CSS. Preserve services and the root alias.
**Tech Stack:** Existing Node 22.12+, Vite, Playwright and native HTML/CSS/JS; no new dependency.
**Spec:** docs/superpowers/specs/2026-11-03-home-clone.md

## Global Constraints
- Preserve / and /services/ and dependency lockfile.
- Do not copy source production JavaScript or submit forms.
- Keep unimplemented routes outbound and all existing content accessible without JS.
- Record actual tests and source/target screenshots; no inferred parity claims.

## Review Focus
- Local navigation, active-page state and desktop resize focus must work on both pages.
- Home-only styles must not change the service layout.
- All full-page sections must be present, not only the hero.
- Theme storage failures and no-JS rendering must remain usable.
- Dynamic counters and live source updates must be documented as snapshots.

## Tasks
- [x] Capture the owned homepage and inspect full-page desktop/mobile and measured geometry.
- [x] Add failing home route/content tests; implement authored home content, scoped styles and build entry.
- [x] Add browser coverage for local navigation, mobile/menu/theme, no-JS and overflow; verify old behavior.
- [x] Run full CI and actual source/production comparisons, inspect images, fix material differences.
- [x] Record scope, assets, evidence and remaining gaps; integrate without force updating main.

## Verification and review ledger

Final code: eff7a054a638e7784c66c447e28f515734be9786. Complete Actions checkout: 642 full checks and 50 behavior/layout checks in each of Chromium, Firefox and WebKit, no failures/cancellations/skips. Six fresh Chromium source/production viewport comparisons completed; no visual pass threshold. All six tolerant ratios are zero but decoded pixels are not identical. Full-page desktop/tablet dimensions match; mobile differs by the existing footer's 8px. Exact figures and reproduction: docs/case-studies/uulab-home/report.md.

Initial content checks: five fail, one pass before implementation. Later style and icon fixes have preserved RED/GREEN logs. Artifact comparison caught a shared icon path typo; restored the original path and added its hash regression. Remote blob was verified against the locally tested Git blob before branch update. Eleven implementation/test files matched the final CI snapshot byte-for-byte. Self-review and independent pixel computation completed; no independent code reviewer was available. Local in-memory previews are not claimed as HTTP or production verification.

Integration is an authorized non-forced fast-forward of the unchanged base main, followed by checking the final commit's ordinary CI and browser CI. Record the final integration outcome in the delivered evidence.
