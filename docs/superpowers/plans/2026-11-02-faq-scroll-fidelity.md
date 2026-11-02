# FAQ scroll fidelity

Goal: close the recorded FAQ header/focus discrepancy in the existing editable example, without weakening keyboard access or pixel metrics.

Scope: observe the owner's public services page, reproduce the discrepancy with local browser tests, then modify only authored example behavior/styles and regression tests. No source production bundle copying, dependencies, submissions, paid services, or changes to image comparison thresholds.

- [ ] Observe fresh source/target header geometry at top, down/up scrolling, FAQ pointer/keyboard activation, and header focus at 390/1440px.
- [ ] Write failing browser regressions for the observed behavior and accessibility safeguards.
- [ ] Implement the smallest fix using the existing Node ESM/Vite example; preserve static/no-JS content and existing mobile menu interactions.
- [ ] Run the full `npm run check` gate and a fresh authorized 10-view comparison; inspect PNGs and record residual gaps before integration.

Decision: preserve prior deliberate opaque menu background and footer wrapping. A scroll-hiding header must remain discoverable on upward scrolling and keyboard focus, even if the reference does not preserve focus visibility. Work on `work/faq-scroll-fidelity`; only integrate a verified commit with a matching main-head lease.
