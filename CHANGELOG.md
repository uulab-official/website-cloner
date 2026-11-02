# Changelog

## 2026-11-02 — three-engine example regression gate

- Added `npm run check:browsers` to build once and run the same authored example behavior tests in Chromium, Firefox and WebKit.
- Kept capture/verify commands Chromium-only; no application CSS/JS, dependency or lockfile changes.
- Require complete test counts and matching browser/version evidence; failed, skipped, cancelled, missing and timed-out tests cannot pass silently. Added canonical output path protection.
- Preserved 21 production-implementation screenshots and engine-specific logs. They are not source/clone comparisons or real device certification.
- Fixed two WebKit test failures caused by equivalent CSS shorthand serialization order by comparing identical longhand properties, not by changing the application or weakening values.
- Verified full gate: 268 toolkit/browser + 10 production-demo tests, 278 total. Repeated behavior suite: 38/38 in each engine, 114 executions of the same 38 checks, not additional unique tests.
- Added main/PR **Demo browser compatibility** CI with failure evidence. Linux WebKit is not branded Safari or a physical iPhone.

[Usage](docs/browser-compatibility.md) · [Versions, test evidence and remaining gaps](docs/case-studies/uulab-services/browser-compatibility-2026-11-02.md)

## 2026-11-02 — scroll progress and responsive controls

- Restored the observed decorative 4px scroll progress bar using the existing animation-frame scheduler; recalculates for scrolling, resizing, FAQ expansion, media loading and observed document-size changes.
- Kept finite zero progress on non-scrollable/no-JavaScript pages and preserved keyboard return-to-main, header focus protection and reduced-motion behavior.
- Removed the mobile-only 20px back-to-top offsets; the 48px control now uses the observed 24px bottom/right offsets at all tested widths.
- Added 13 browser regressions. Verified 11 expected assertion failures before the fix; final full gate passes 227 toolkit/browser + 9 production-demo tests, 236 total, with no failures or skips.
- Captured six cases/ten viewports afresh. FAQ filtered differences become zero, but exact RGBA differences remain 0.183873% desktop and 0.200570% mobile; neither is a site quality score.
- Re-ran full-page comparison without resizing. Desktop/tablet comparisons complete; the intentional readable footer wrapping retains an 8px mobile height mismatch, recorded as dimension_mismatch/exit 1/reviewRequired.
- Added opt-in **Scroll progress fidelity** workflow and preserved normal CI independence from the production source. No dependency or threshold changes.

[Fresh evidence, source observations and remaining gaps](docs/case-studies/uulab-services/progress-fidelity-2026-11-02.md)

## 2026-11-02 — FAQ scroll and focus fidelity

- Matched the observed 100px scroll threshold: hide the fixed header on downward scroll and reveal it on upward scroll or at the top.
- Kept open mobile navigation and focused header controls visible; duplicate scroll events do not change visibility, and page restoration resets the header safely.
- Matched FAQ pointer/keyboard focus outline, offset, and shadow without removing keyboard indicators.
- Added ten real-browser regressions, including no-JavaScript fallback and reduced-motion preference changes. Full gate: 214 toolkit/browser tests + 9 production-demo tests passed.
- Captured fresh authorized source/target evidence for six cases and ten views. FAQ filtered differences decreased from 1.648765% to 0.249614% (desktop) and 2.445584% to 0.452137% (mobile); these are screenshot metrics, not completion scores.
- Added the opt-in **FAQ scroll fidelity** workflow; regular CI still has no production-site dependency. No dependency or comparison-threshold changes.

[Observations, measurements, test evidence and remaining gaps](docs/case-studies/uulab-services/scroll-fidelity-2026-11-02.md)

## 2026-11-01 — paired live verification

- Added `npm run verify`: source URL + implementation URL → matched captures, pixel differences, JSON, and a script-free HTML report.
- Kept the portable `website-clone` skill, editable UULab services example, MIT notices, existing capture/comparison commands, and exact dependency versions.
- Added strict capture-condition compatibility checks and regression coverage for failed evidence, output protection, escaped report content, and explicit threshold handling.
- Added a separate opt-in GitHub Actions live workflow; standard CI still tests local fixtures without depending on the production source.
- Executed a real UULab source/clone comparison at 1440/768/390px and a narrow open-menu state. Results and intentional differences are documented, not represented as a universal clone-quality score.

[Run the verifier](docs/paired-verification.md) · [Live trial report](docs/case-studies/uulab-services/live-verification-2026-11-01.md) · [Measurements](docs/case-studies/uulab-services/live-2026-11-01.json)
