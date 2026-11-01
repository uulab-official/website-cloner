# Verification suite integration

## Goal
Integrate the previously delivered verification-suite patch into the full repository, run the complete existing gate, and obtain fresh live evidence instead of replaying old captures. The user requested continued implementation and publication to this repository.

## Approach and scope
Use the existing Node ESM, pinned dependencies and paired verifier. Do not replace the authored frontend, copy production bundles, add a hosted service, change dependencies, or claim backend/function parity. Use a feature branch before a lease-protected fast-forward to main. No independent reviewer is available; final review is in-session.

## Tasks
1. Restore suite config/runner/CLI and the existing 99 suite tests from the supplied patch; preserve upstream files.
2. Add an opt-in workflow that runs npm run check from a complete checkout, then captures the existing four-case/seven-viewport live manifest. Store logs and all available evidence on failure too.
3. Inspect actual CI logs, JSON and screenshots; fix reproduced integration failures with regression tests before merging.
4. Record measured results and limits. Recheck remote main before publishing the verified code.

## Decisions
- The sandbox cannot resolve github.com; use the connected repository and its GitHub Actions runner rather than claiming local full-check coverage.
- The example manifest uses no arbitrary visual threshold. Completed comparisons are not visual approval.
- Live tests remain explicitly opt-in; ordinary CI uses owned local fixtures.
- The dark case deliberately clicks both pages' theme controls from a light browser preference; state labels do not imply system preference.

## Verification targets
Full toolkit tests, existing real-browser tests, production build, demo browser checks, suite preflight, and fresh paired capture for default 1440/768/390, menu 390, dark 1440, and root alias 1440/390. Do not infer a pass before reading the actual logs.
