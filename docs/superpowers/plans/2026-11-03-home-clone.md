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
- [ ] Add browser coverage for local navigation, mobile/menu/theme, no-JS and overflow; verify old behavior.
- [ ] Run full CI and actual source/production comparisons, inspect images, fix material differences.
- [ ] Record scope, assets, evidence and remaining gaps; integrate without force updating main.

## Execution ledger
Local content tests: 5 failed / 1 passed before implementation; all 6 passed after. Browser execution and full gate require the complete Actions environment. In-memory local screenshots are layout previews only, not production or route validation. Fresh source text differs from the previous preparation artifact; use the new observed body and keep the distinction in the case study.
