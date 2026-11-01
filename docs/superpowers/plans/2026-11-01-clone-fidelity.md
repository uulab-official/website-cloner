# Clone controls and expanded evidence implementation plan

> Execute inline using the existing Node ESM/Vite/Playwright stack. This continues the requested website-cloner work, not a redesign.

## Goal and constraints
Reduce observed header/control differences in the UULab services clone, preserve keyboard accessibility and the opaque mobile menu, and add FAQ/full-page evidence without describing viewport similarity as whole-site fidelity. No new dependencies, copied production JavaScript, secret inputs, form submission, or automatic similarity threshold.

## Approach
Use measured source computed styles and existing capture evidence to identify causes; avoid guessing from pixel percentages. Keep intentional accessibility improvements (opaque panel, focus-visible and wrapped footer links). A separate work branch protects main. This environment cannot resolve GitHub from its shell, so the connected GitHub API and Actions provide the complete checkout and browser verification.

## Tasks
- [ ] Inspect source and clone controls in matching browser states; retain computed properties and a source-only code snapshot for local review.
- [ ] Add regression assertions for identified geometry/icon/state issues, run them against unchanged code and record failures.
- [ ] Apply minimal authored CSS/markup fixes, preserving responsive navigation, Escape/focus restoration and storage handling.
- [ ] Extend the opt-in suite with FAQ states and compare full-page PNGs when dimensions match; retain a dimension mismatch instead of scaling images.
- [ ] Run npm run check and a fresh live suite; inspect screenshots, document measured changes and deliberate differences.
- [ ] Self-review the exact diff, then fast-forward main only if full checks pass and its expected head has not changed.

## Review focus
Keyboard focus after theme/menu changes; reduced-motion behavior; mobile layout and horizontal overflow; source UI state versus browser color scheme; reporting missing/different-size full-page evidence without false pass.

## Ledger
- Baseline: ae5689b5fed3e849204df8be2130bd369e2632f1. Existing evidence includes a 1.93048% menu viewport diff and an 8px mobile full-page height difference.
- Decision: retain the opaque menu rather than reproduce source text bleeding through it; exact pixel identity is not the acceptance condition for this intentional difference.
