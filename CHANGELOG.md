# Changelog

## 2026-11-01 — paired live verification

- Added `npm run verify`: source URL + implementation URL → matched captures, pixel differences, JSON, and a script-free HTML report.
- Kept the portable `website-clone` skill, editable UULab services example, MIT notices, existing capture/comparison commands, and exact dependency versions.
- Added strict capture-condition compatibility checks and regression coverage for failed evidence, output protection, escaped report content, and explicit threshold handling.
- Added a separate opt-in GitHub Actions live workflow; standard CI still tests local fixtures without depending on the production source.
- Executed a real UULab source/clone comparison at 1440/768/390px and a narrow open-menu state. Results and intentional differences are documented, not represented as a universal clone-quality score.

[Run the verifier](docs/paired-verification.md) · [Live trial report](docs/case-studies/uulab-services/live-verification-2026-11-01.md) · [Measurements](docs/case-studies/uulab-services/live-2026-11-01.json)
