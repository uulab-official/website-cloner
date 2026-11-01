# Website Cloner Implementation Plan

**Goal:** Deliver the portable skill, executable evidence tools, and a verified live-site clone case study in the user's public repository.

**Architecture:** A self-contained skill coordinates an agent. Independent Node.js CLIs collect and compare evidence. An isolated Vite example exercises the workflow and is covered by local browser tests.

**Tech stack:** Node.js 22.12+, Playwright, PNGJS, Pixelmatch, Vite; editable semantic HTML/CSS/JavaScript in the example.

**Spec:** `docs/superpowers/specs/2026-11-01-website-cloner-design.md`.

## Global constraints

Preserve MIT attribution. No paid APIs, forced stack migrations, copied production bundles, or external form submissions. Keep tests independent of the live source. Publish only the requested repository. The skill must work when installed alone.

## Tasks

- [x] Adapt and validate the skill in the personal-skills checkout, then copy the validated directory to `skills/website-clone/`.
- [x] Write tests for malformed inputs, file overwrite behavior, identical/different PNGs, and mismatched dimensions; implement `scripts/capture.mjs`, `scripts/compare.mjs`, and their shared helpers.
- [x] Observe the live source desktop and theme/FAQ states; capture matched desktop/tablet/narrow static references. Record that original mobile JavaScript and motion could not be verified live. Download approved local assets before implementation.
- [x] Build the editable example; exercise theme persistence, responsive menu, FAQ, deep route loading, asset loading, overflow, and console errors with local Playwright tests.
- [x] Compare matched reference/local states and full-page structure; correct the open-menu readability issue and document remaining limitations without inventing a similarity score.
- [x] Add README, contribution guidance, licenses, CI, commands, case study, and visual QA. Run the full 48-test gate and independent review.
- [ ] Commit, push, and verify the remote tree and GitHub Actions result.

## Interfaces

`capture --url URL --out DIR --widths 1440,390 --height 900 --scheme light --state LABEL` emits `capture.json` and `<width>x<height>/{page.json,viewport.png,full-page.png}`. Optional `--actions FILE` selects explicit click/scroll states; `--overwrite` is required to replace evidence.

`compare --source PNG --target PNG --out DIR` emits `report.json`, `diff.png`, and `side-by-side.png`; dimensions must match. Optional `--max-diff-ratio` is a chosen gate, not an intrinsic quality guarantee.

## Review focus

Check untrusted URL/config input, destructive output paths, partial evidence after failure, reference/asset paths in a standalone skill, and demo checks that could pass without proving actual interaction.

## Progress

Upstream is MIT at `ee3f5a2f31fd549b9593fa4f7cf6d2955ee593bb`; original notices are retained. The standalone skill is installed and validated, and Skills CLI 1.7.4 discovers exactly `website-clone`. Tooling and the nine-section example are implemented. The final local gate passes 39 tool tests plus 9 browser tests without skips; the production build succeeds. Independent review found no Critical/Important code issue and its screenshot-dimension labeling note is resolved. See the case-study report and root `design-qa.md` for measured evidence, the fixed menu issue, and explicit live/mobile/motion limits. Remote publication is the remaining release step.
