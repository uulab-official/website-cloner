# Build and CI readiness implementation plan

Goal: eliminate stale demo builds and obsolete Actions runtimes without changing the authored clone or dependency lockfile.

Spec and architecture: keep dist/demo as the generated output. Validate Vite's fully resolved root/output before cleanup. Reject output overrides and symlinked output directories. Only then permit emptyOutDir. Preserve every sibling directory. Existing Node 22/24 test environments remain unchanged. Pin official Node 24 Actions releases by commit. Refresh current how-to pages; historical case studies stay dated evidence.

- [x] Run real Vite regressions against the old configuration in disposable fixtures and retain expected failures.
- [x] Implement examples/uulab-services/build-policy.mjs and integrate it in vite.config.js; rerun the same tests.
- [x] Run these build checks from the full gate, migrate all workflow action references, and preserve read-only permissions.
- [x] Update README/current documentation and verify commands, routes, and reports from a fresh Actions checkout.
- [x] Review the whole code diff and run full regression plus three engines.
- [ ] Integration gate: verify final main CI and browser CI after fast-forwarding the tested code plus evidence-only documentation. This checkpoint is recorded before the integration, not an assertion of future success.

Review focus: unsafe CLI outDir overrides; dist/demo or its parent symlinks; stale chunks; sibling data; both HTML entrypoints; unchanged package-lock and frontend sources. Tests use only disposable roots. No production submissions or new runtime dependency.

Execution: isolated work/build-ci-readiness branch from 6880114. Local network cannot clone GitHub; locally recovered source is a partial snapshot. Full verification uses the complete Actions checkout, not partial local test results. Review is author self-review, not independent review.

Verified implementation: 52f568f21ad6c516ce38bd844a1fb8d92684520e. Run 41440679286 completed successfully: 328 toolkit/browser + 7 actual Vite build + 10 production-demo checks, 345 total, no failures or skips. Same behavior checks passed 38/38 per Chromium, Firefox and WebKit. The 13 generated frontend files are byte-identical to baseline main. Eight maintained guides have valid local links and npm command names. Red run 41438666407 retained seven expected build assertion failures.

Ruling: keep dated case-study statements as historical evidence; correct current reference pages and help instead. Cost: readers must distinguish dated evidence from current usage, explained by docs/README.md.
Ruling: reject output overrides instead of allowing arbitrary cleanup destinations. Cost: deploy elsewhere by copying the verified generated directory; concurrent hostile filesystem mutation remains outside this local guard.

See ../../build-readiness-2026-11-02.md for actual evidence and limits.
