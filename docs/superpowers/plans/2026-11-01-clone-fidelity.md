# Clone controls and expanded evidence implementation plan

> Executed inline using the existing Node ESM/Vite/Playwright stack. This continues the requested website-cloner work, not a redesign.

## Goal and constraints
Reduce observed header/control differences in the UULab services clone, preserve keyboard accessibility and the opaque mobile menu, and add FAQ/full-page evidence without describing viewport similarity as whole-site fidelity. No new dependencies, copied production JavaScript, secret inputs, form submission, or automatic similarity threshold.

## Approach
Use measured source computed styles and existing capture evidence to identify causes; avoid guessing from pixel percentages. Keep intentional accessibility improvements (opaque panel, focus-visible and wrapped footer links). A separate work branch protects main. The working shell cannot resolve GitHub and its browser blocks local navigation by policy; the connected GitHub API and Actions provide the complete checkout and browser verification. No local policy bypass was attempted.

## Tasks
- [x] Inspect source and clone controls in matching browser states; retain computed properties and a code snapshot for local review.
- [x] Add regression assertions for geometry/icon/state/short-height issues, run against unchanged code and record failures.
- [x] Apply minimal authored CSS fixes, preserving responsive navigation, Escape/focus restoration and storage handling.
- [x] Extend the opt-in suite with FAQ and dark mobile menu; compare full-page PNGs and retain dimension mismatch without scaling.
- [x] Run npm run check and a fresh live suite; inspect screenshots and document measured and deliberate differences.
- [x] Self-review the exact diff. Publication is a non-force fast-forward only after verifying the expected main head.

## Review focus
Keyboard focus after theme/menu changes; reduced-motion behavior; mobile layout and horizontal overflow; source UI state versus browser color scheme; reporting missing/different-size full-page evidence without false pass.

## Ledger and decisions
- Baseline: ae5689b5fed3e849204df8be2130bd369e2632f1. Diagnostic run 41314432825 completed 178 tests and fresh computed-style evidence.
- RED: dcd9a09148e390c7a1c8cd8aad42b64b8fb9bae4, run 41314878142: 169 existing toolkit tests passed; all 5 new browser assertions failed for the intended reason (geometry, rotation, two focus states, short-screen reachability).
- GREEN: 69a40f35d6c105048be99c8a3733af65fea7da36, run 41315250125: 174 toolkit/browser tests plus 9 production demo tests passed, zero failures/cancellations/skips; build and skill checks passed. Separate normal CI 41315250019 succeeded. Local partial-snapshot 99-test success is not counted as the full gate.
- Fresh evidence: 6 cases / 10 viewport-state pairs completed. Full-page 1440/768 compared, 390 retained dimension_mismatch (12617 vs 12625). Short-height 390x320 screenshot and browser reachability assertion verified.
- Ruling: retain opaque menu, brighter dark moon and footer wrapping for readability; the cost is deliberate pixel differences rather than exact source reproduction.
- Ruling: full-page dimension mismatch remains an incomparable diagnostic with exit code 1 and reviewRequired=true; other comparison failures fail the workflow. Workflow completion is not visual approval.
- Ruling: do not call a 0% pixelmatch result exact identity. Threshold 0.1 ignores visible weak-color differences: menu raw RGBA audit found 122805/351000 differing pixels. Report both scope and method rather than change thresholds to improve a score.
- Final review: self-review (no subagent tool). Exact product change is 7 added/3 removed CSS lines; no production JS, content, assets, dependency or lock changes. Reviewed suite states, report failure handling and screenshots. No blocking regression found in the tested scope.
- Deferred: source scroll-triggered header/FAQ focus fidelity; generic low-contrast audit in the CLI; Safari/Firefox/real devices/touch/Windows/macOS/general motion; existing Vite outDir and Actions v4 deprecation warnings. None is claimed complete.

See ../../case-studies/uulab-services/fidelity-polish-2026-11-01.md for evidence and limitations.
