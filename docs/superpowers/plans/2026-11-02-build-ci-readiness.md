# Build and CI readiness implementation plan

Goal: eliminate stale demo builds and obsolete Actions runtimes without changing the authored clone or dependency lockfile.

Spec and architecture: keep dist/demo as the generated output. Validate Vite's fully resolved root/output before cleanup. Reject output overrides and symlinked output directories. Only then permit emptyOutDir. Preserve every sibling directory. Existing Node 22/24 test environments remain unchanged. Pin official Node 24 Actions releases by commit. Refresh current how-to pages; historical case studies stay dated evidence.

- [ ] Run real Vite regressions against the old configuration in disposable fixtures and retain expected failures.
- [ ] Implement examples/uulab-services/build-policy.mjs and integrate it in vite.config.js; rerun the same tests.
- [ ] Run these build checks from the full gate, migrate all workflow action references, and preserve read-only permissions.
- [ ] Update README/current documentation and verify commands, routes, and reports from a fresh Actions checkout.
- [ ] Review the whole diff; run full regression plus three engines; integrate only the tested tree, then verify main.

Review focus: unsafe CLI outDir overrides; dist/demo or its parent symlinks; stale chunks; sibling data; both HTML entrypoints; unchanged package-lock and frontend sources. Tests use only disposable roots. No production submissions or new runtime dependency.

Execution: isolated work/build-ci-readiness branch from 6880114. Local network cannot clone GitHub; locally recovered source is a partial snapshot. Full verification must use the complete Actions checkout, not partial local test results. Review is self-review unless an independent reviewer actually runs.
