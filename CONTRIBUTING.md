# Contributing

Website Cloner contains a portable agent skill, optional evidence tools, and an isolated example. Keep those three pieces independently usable.

## Local setup

Use Node.js 22.12+ for this repository. The optional external Skills CLI requires Node.js 22.20+.

```bash
npm ci
npx playwright install chromium firefox webkit
npm run check
npm run check:browsers -- --out artifacts/browser-check
```

On Linux, Playwright's `--with-deps` installer can install browser system dependencies. Install a Korean font such as Noto CJK when checking the included example. `CLONER_CHROMIUM_PATH` can explicitly select an existing Chromium; record its version when collecting evidence.

The full check includes `npm run test:build`: real Vite builds in disposable fixtures verify stale-file cleanup, sibling preservation, and rejected unsafe output paths. Never put personal files in generated `dist/demo`. See [build and CI policy](docs/build-and-ci.md).

The full check runs skill validation, real browser capture tests, PNG and file-protection tests, the example build, and example interaction checks. It must not silently skip browser integration. Tests use local fixtures, so they do not depend on the live UULab website.

## Changes

- Keep `skills/website-clone/` self-contained. A user installing only that directory must not need repository scripts or the example. Retain attribution and copy referenced files with the skill.
- Preserve the caller's framework and existing routes. The Vite example is not a framework requirement.
- Add a meaningful regression check for changed capture/compare behavior, especially destructive-path protection, failure records, or screenshot state. Update CLI help when options change.
- Use the recorded viewport, browser, fonts, theme, and state when comparing screenshots. Do not rescale unequal images to make a comparison pass.
- Describe pixel differences as diagnostics. Keep functionality, source observations, inference, and unverified behavior distinct.
- Do not commit credentials, signed URLs, private page text, browser storage, or generated evidence from accounts that were not authorized for publication. Review capture JSON as well as images.
- Keep production source bundles and temporary inspection downloads out of examples. An example should be editable frontend code with explicit asset provenance.

For a new case study, follow the report sections in the skill, record asset origins and rights, include source/local state evidence, and explain remaining differences. Do not submit contact, purchase, or account forms as part of a clone demonstration.

## Pull requests and issues

Explain the problem, the behavior that changed, the command or browser scenario used to verify it, and relevant limitations. A reproduction for a tool issue should include Node/browser versions, the command, a small public/local fixture, and a sanitized error record. Visual issues benefit from a matched source/local pair and the viewport/state used.

New project code is MIT. Preserve each third-party asset's existing license and notices; the included UULab brand/project images are case-study material, not a general trademark grant.
