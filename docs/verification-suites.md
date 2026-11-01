# Verification suites / 여러 화면 상태 일괄 검증

`npm run verify:suite` runs named route/state pairs through the existing `verify` command. It does not generate application code or recover a backend. It adds repeatable execution and a single offline evidence index without changing the portable agent skill.

## Run the UULab example

```bash
npm ci
npx playwright install chromium
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

In another terminal:

```bash
# Validate without starting a browser, making requests or writing output.
npm run verify:suite -- \
  --config docs/case-studies/uulab-services/verification-suite.json --dry-run

# Live authorized source versus local production build: 4 states, 8 viewport pairs.
npm run verify:suite -- \
  --config docs/case-studies/uulab-services/verification-suite.json \
  --out artifacts/uulab-suite

# Recheck only the mobile menu, with an alternate local port.
npm run verify:suite -- \
  --config docs/case-studies/uulab-services/verification-suite.json \
  --only menu --target-origin http://127.0.0.1:5173 \
  --out artifacts/menu-recheck
```

Open `artifacts/uulab-suite/index.html`. Relative links open each case's existing paired report with viewport screenshots, full-page images and pixel differences. Keep the whole directory together when sharing it. `suite.json` contains the normalized execution plan, selected/excluded cases, process diagnostics, per-viewport results and totals. Reports are saved after each case, so earlier results remain available if a later case fails. A case failure does not stop the remaining cases.

## Manifest

```json
{
  "schemaVersion": 1,
  "name": "Authorized site",
  "defaults": { "widths": [1440, 390], "height": 900, "maxDiffRatio": null },
  "cases": [
    {
      "id": "home",
      "source": "https://example.com/",
      "target": "http://127.0.0.1:4173/"
    },
    {
      "id": "menu",
      "source": "https://example.com/about/",
      "target": "http://127.0.0.1:4173/about/",
      "widths": [390],
      "state": "menu-open",
      "sourceActions": [{ "type": "click", "selector": "#source-menu" }],
      "targetActions": [{ "type": "click", "selector": "#local-menu" }]
    }
  ]
}
```

Default settings: widths `[1440,768,390]`, height `900`, scheme `light`, `keepScroll: false`, `maxDiffRatio: null`. Case settings override defaults. `state` defaults to the case ID. Inline actions default to empty arrays and accept only `click` and `scroll`, using each site's actual selectors. Actions do not automatically prove the intended interaction outcome; inspect the resulting evidence and run functional tests separately.

Use `keepScroll: true` for below-fold states. Without it, capture returns to the page top after actions. `scheme` controls the browser's preferred color scheme; it does not press a site's theme toggle. The bundled dark case explicitly clicks the observed toggle. The FAQ case scrolls to the heading, opens the first answer and preserves that resulting scroll position. Inspect the underlying `page.json` scroll values when interpreting differences.

## Execution versus visual gates

- `status: completed` means the requested evidence was captured and reconciled, **not** that the clone looks correct.
- `maxDiffRatio: null` produces `not_requested`; no pass threshold is invented.
- A numeric ratio from `0` to `1` is an explicit gate. `0.02` permits at most 2% changed pixels using the existing comparator's semantics; it is not a claim of 98% fidelity.
- A failed/missing capture leaves a requested gate `not_evaluated`. Failed thresholds remain `failed`; missing/duplicate viewport rows or mismatched URLs/state/conditions cannot be successful.
- Browser diagnostics are warnings by default. `--fail-on-warnings` makes them fail the suite without relabeling visual gates.

Exit code is `1` for invalid configuration, any failed case or strict-warning failure, otherwise `0`. A suite can exit `0` with all visual gates `not_requested`: inspect the report. A subset run lists excluded cases rather than implying the whole suite passed. `functionalParity` always remains `not_verified`.

## Bounds and safety

The manifest is at most 1 MB; there are 1–20 cases and at most 60 viewport pairs. Each case uses 1–10 unique integer widths; dimensions are 1–8192. Each side permits at most 50 actions with selectors up to 2000 characters; its serialized UTF-8 action file must also fit the existing 100 KB capture limit. State labels cannot start with `--` (a downstream CLI flag). IDs are unique lowercase slugs, at most 64 characters, excluding reserved device names. Unknown keys and incorrectly typed settings are errors, including in unselected cases. These limits bound input size, not resource usage: large pages/screenshots can still be expensive.

`--overwrite` replaces only a prior `verify-suite`-owned directory. It cannot overwrite a `capture`/`verify` run, the manifest, the selected browser executable or an unrelated nonempty directory. A different output path is the safest default.

`--source-origin` and `--target-origin` accept only an HTTP(S) origin and preserve each route's path/query/fragment. They are convenience mappings, **not** network sandboxing. Redirects and subresources are not origin-isolated. The tool is intended for trusted local development, not as a publicly hosted URL capture endpoint. It does not implement SSRF isolation, authentication recovery or access-control bypass.

Use only pages/assets/actions within your authorization. Do not submit forms, purchases or other mutations while inspecting a source. Restricting action types does not make arbitrary clicks read-only. Do not put secrets in URLs, selectors or page content: URLs, logs and screenshots are retained. HTML reports escape captured text and load no scripts or remote assets.

## Tests and automation

`npm run check` includes native suite unit/CLI tests alongside existing checks. `npm run test:suite` exercises the real capture and compare subprocesses against a local HTTP fixture: multiple routes, menu actions, an HTTP failure, a visual-gate failure and recovery in a later case. Normal CI runs both commands without live third-party source pages.

The separate `Live UULab clone evidence` workflow runs the bundled live suite on manual dispatch and its dedicated development branches. It uploads evidence even on failure; live source/asset changes can legitimately alter results. Chromium emulation is not a physical-device, Safari, motion or backend test.
