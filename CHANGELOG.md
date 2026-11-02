# Changelog

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
