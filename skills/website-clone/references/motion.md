# Framer and motion inspection

## Framer pages

Inspect visible computed layouts at each viewport. Generated pages may contain duplicate desktop and mobile variants; their DOM order is not a component design. Use section names as clues and reconstruct semantic components in the target framework.

Wait for hydration, fonts, and entrance effects. Visit offscreen sections before capturing them so lazy media and reveal animations can appear. Capture initial and revealed states when the movement contributes to the design.

Inspect the asset that actually renders, including responsive source, crop, font weight, and video poster. Framer CDN filename extensions can differ from actual image formats. Export SVG definitions and referenced dependencies with their shapes, then verify the saved asset in its local usage.

For CMS-style grids, inspect supplied detail routes and meaningful filter states. Reproduce the observed navigation and filtering scope; mark private or unavailable data separately.

## Identify the driver

| Driver | Observe | Implementation choices |
| --- | --- | --- |
| Time | Cycle, delay, duration, direction, pause, loop | CSS keyframes, media, animation library |
| Scroll reveal | Entry boundary, start/end position, replay | IntersectionObserver with CSS or existing library |
| Continuous scroll | Progress, pin distance, layer speed, release | Scroll progress with styles or existing library |
| Click/hover/focus | Alternate state, transition, dismissal | Semantic controls and state with CSS |
| Pointer/canvas | Input response, renderer, visual identity | Appropriate renderer or documented approximation |

Observe actual input behavior in both directions. A pinned section includes its start, duration, release, and reverse-scroll behavior. A visual may be video or animated SVG rather than a CSS effect. Watch one complete cycle before describing it.

Identify page-wide smooth scrolling, snapping, transitions, or cursor behavior from observed scripts/classes and permitted inspection. Do not assume all Framer pages use the same library or settings. Inspect the site's actual options before choosing an equivalent.

Prefer the host project's existing animation approach. Add a library only when the required behavior justifies it. Clean up listeners, observers, animation frames, and timers when components unmount.

## Verify motion

Record and compare initial, active, and settled states with equivalent viewport and input. Test controls while motion runs and after navigating away/back. Check both mobile and desktop where behavior differs.

Provide a readable reduced-motion state and keep content reachable with keyboard input. Confirm animation does not cause overflow, leave content invisible, trap focus, or block navigation. Document this intentional accessibility behavior when it differs from the source.

A still screenshot cannot establish a scroll timeline, video cycle, shader, or pointer response. Report an approximation precisely when the exact behavior remains outside scope or unsupported.
