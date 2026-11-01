# Live verification — 2026-11-01

The editable UULab services reconstruction was tested against the **actual live HTTPS source**, not the earlier static reference. Existing authored example code was retained; this iteration adds repeatable paired verification and records a fresh clone trial.

## Reproducible evidence

- Captured code: `2df12d872746827873365193c008dd6f35224e69`.
- [Live run 41307323047](https://github.com/uulab-official/website-cloner/actions/runs/41307323047): completed successfully, including both default and menu-state capture/comparison commands.
- [Full check run 41307322958](https://github.com/uulab-official/website-cloner/actions/runs/41307322958): completed successfully; `npm run check` includes the skill validator, toolkit/browser tests, production build, and example browser tests.
- [Raw evidence ZIP](https://github.com/uulab-official/website-cloner/actions/runs/41307323047/artifacts/13084285418), artifact `13084285418`: 46 files, 14,390,297 bytes, retained by Actions for 14 days.
- ZIP SHA-256: `f788b7adb976dd391acb25c4aa133ea432644b3b07463d7f26c842d71307fe08`.
- [Durable measurement summary and screenshot hashes](live-2026-11-01.json). The summary is a subset derived from the downloaded raw JSON/PNGs, not a replacement for the full evidence.

The runner used Node 24.22.1 and Playwright's Chromium **151.0.7922.34**, with Noto CJK installed. Both sides were captured in fresh headless contexts, DPR 1, locale en-US, timezone UTC, light preference, and reduced motion. Viewports were desktop Chromium contexts at different widths, **not physical mobile devices**.

Source: `https://uulab.co.kr/services/`. Target: the production build served at `http://127.0.0.1:4173/services/` on the runner. The live source loaded with certificate verification enabled. No forms, purchases, logins, production changes, or source production JavaScript copying were performed.

## Measured viewport differences

| State | Viewport | Changed / total pixels | Changed-pixel ratio |
| --- | --- | --- | --- |
| Default desktop | 1440 × 900 | 2,216 / 1,296,000 | 0.17099% |
| Default tablet width | 768 × 900 | 1,122 / 691,200 | 0.16233% |
| Default narrow width | 390 × 900 | 0 / 351,000 | 0% |
| Menu open, narrow width | 390 × 900 | 6,776 / 351,000 | 1.93048% |

Pixelmatch threshold is 0.1 with antialiasing excluded. No maximum ratio was requested: `visualGate` is `not_requested`, not `passed`. All four pairs completed without captured console/page/request/HTTP diagnostics. This is not a semantic accuracy percentage, a whole-page equality claim, or proof of functional parity.

The narrow default viewport PNGs also have equal SHA-256 hashes in this run. Their full pages are **not** identical: source document height is 12,617px and implementation is 12,625px, consistent with the previously documented intentional narrow-footer wrapping. Desktop document heights are both 7,129px; tablet-width heights are both 9,117px. Automatic paired comparisons use viewport PNGs and never resize the full pages.

## Visual inspection and intentional differences

The desktop side-by-side and narrow open-menu PNGs were opened and reviewed after downloading the artifact. The source menu visibly lets the underlying hero heading/text show through its translucent surface; the implementation keeps the previously authored opaque surface for readability. Panel height and toggle/focus appearance also differ. These differences are retained and disclosed rather than changing the clone to reproduce source readability problems or calling the images identical.

This run **does observe the live source menu opening** after clicking `.navbar-toggler`, unlike the earlier historical report. It does not verify every source close/keyboard/focus/touch behavior, and a successful click by itself is not an interaction-parity assertion. The authored example's own functional tests remain separate from source parity.

## New reusable workflow

Use [paired verification](../../paired-verification.md) to repeat the attempt:

```bash
npm run verify -- --source https://uulab.co.kr/services/ --target http://localhost:5173/services/ --out artifacts/live-check
```

Open the generated `index.html` for source/target screenshots, full-page links, diffs, diagnostic warnings, and JSON. Source/target actions may use different selectors. Ordinary CI uses local fixtures; the opt-in live workflow uses the public UULab route. Artifacts are preserved on failures as well as success.

## Review and remaining scope

Final code review was self-review; no independent reviewer was available. It identified an ambiguous threshold label when evidence was missing/inconsistent. Three regression tests were observed failing and then passing after changing requested-but-unverifiable thresholds to `not_evaluated` and rejecting mismatched threshold metadata. This reporting fix does not change the example, capture engine, comparison algorithm, or the recorded images above.

Full live functional parity, motion, Safari/Firefox, physical touch devices, additional routes, authentication, contact submission, and backend reproduction remain outside the verified scope. Historical [static-reference evidence](report.md) remains separate and dated; do not relabel it as live evidence.
