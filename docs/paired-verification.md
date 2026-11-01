# Paired URL verification

`verify` composes the existing capture and comparison tools. It does not generate frontend code, restore a backend, or replace the `website-clone` skill. Build the editable example/implementation first, start its local server, then compare it with a page you own or are authorized to inspect.

```bash
npm ci
npx playwright install chromium
npm run dev
# In another terminal, use the port printed by Vite:
npm run verify -- --source https://uulab.co.kr/services/ --target http://localhost:5173/services/ --out artifacts/live-check
```

Defaults are 1440, 768, and 390 CSS pixels wide, 900 pixels high, with fresh Chromium contexts, light preference, and reduced motion. Both URLs are actually requested; the tool never silently substitutes a static reference or disables certificate checks. Small widths are not physical touch-device emulation. Linux needs appropriate fonts (for this case, Noto CJK). Both captures use the same installed browser, selected explicitly with `--executable-path` when required.

## Inspect the results

Open `artifacts/live-check/index.html`, or serve that directory locally. The script-free report contains source/target viewport images, full-page image links, pixel diffs, capture diagnostics, and the JSON report. It escapes evidence text and does not embed source HTML, scripts, or external assets.

`verification.json` distinguishes:

- `status`: whether capture/comparison execution completed; not a clone-quality grade.
- `visualGate`: `not_requested` unless a maximum pixel ratio was explicitly supplied. `--max-diff-ratio 0.02` sets a project-specific threshold; it is not a semantic fidelity score. A requested threshold with unavailable or inconsistent evidence remains `not_evaluated`, never `passed`.
- `functionalParity`: always `not_verified`. Use separate browser assertions and manual review for interaction behavior.

A failed capture, incompatible browser/viewport/state conditions, missing comparison, or exceeded explicit threshold exits nonzero. Source and target failures remain visible, and a failed source is never compared as an empty success. Console errors and resource failures are warnings to inspect, not proof of functional correctness even when execution exits zero.

Full-page screenshots are retained for visual review, but automatic comparisons use equal-size viewport images. No resizing or height padding hides layout differences. Each run preserves the existing per-page metadata and its source URLs, so **do not capture secret-bearing URLs or private user data into public artifacts**.

## State captures

Actions are existing local JSON arrays of `click`/`scroll` entries. Different selectors are supported for the source and the newly authored frontend:

```bash
npm run verify -- --source https://uulab.co.kr/services/ --target http://localhost:5173/services/ --out artifacts/menu --widths 390 --state menu-open --source-actions docs/case-studies/uulab-services/evidence/actions/menu.json --target-actions docs/case-studies/uulab-services/evidence/actions/menu.json
```

A successful click only means the action ran; inspect the resulting screenshot or assert the expected state independently. Do not run actions that submit forms, buy items, authenticate, or modify a production service. Add `--keep-scroll` to retain action scroll positions. Replacing an existing tool-owned verification run requires `--overwrite`; directories containing action inputs or the browser executable are protected.

## Repeatable checks

`npm run check` includes paired real-browser tests against an owned local fixture: an identical page must compare, and an HTTP 500 source must remain a failure. Plain `npm test` skips browser-dependent checks unless the capture-test browser environment is enabled.

The **Live UULab clone evidence** GitHub Actions workflow is separate and opt-in through Run workflow. Its dedicated implementation branch also triggers it while developing this change. It builds the existing example, captures the public source and local implementation at three widths, and tries the mobile menu state. Artifacts are uploaded even on failure and expire after 14 days; preserve reviewed evidence separately when needed. Live runs never run on ordinary pull requests and use a fixed public UULab URL, not an arbitrary workflow input. No secrets or write permissions are needed.

Read the [2026-11-01 live run findings](case-studies/uulab-services/live-verification-2026-11-01.md). Old [static-reference findings](case-studies/uulab-services/report.md) remain historical evidence, not a substitute for fresh live runs.
