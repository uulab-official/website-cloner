# Verification and handoff

## Match the comparison conditions

Pair source and local views by route, viewport width/height, device scale where relevant, scroll position, color mode, and interaction state. Wait for fonts and meaningful media/reveals to settle. Note animation timing or dynamic content that prevents a stable pair.

Capture desktop and mobile at minimum. Add each discovered breakpoint/state that changes important composition. Use a full-page view to locate differences and full-size section views to assess details. Preserve captures under the evidence bundle and link them from the state matrix.

For screenshot-only input, compare only the provided visible region and available dimensions. Mark unseen sections and responsive rules as inferred or unverified. A generated preview is not source evidence.

## Repair in order

| Priority | Compare | Practical implication |
| --- | --- | --- |
| 1 | Missing sections, layers, content | Complete the requested page before polishing details |
| 2 | Container width, columns, major geometry | Correct the layout rule rather than individual offsets |
| 3 | Font family/weight, wrapping, line height | Verify the loaded font before changing text boxes |
| 4 | Asset identity, ratio, crop, resolution | Fix the source or crop rather than recreating it loosely |
| 5 | Spacing, borders, color, shadows | Refine details after geometry is stable |
| 6 | State transitions and motion | Verify behavior with actual inputs and time |

Recheck only the affected views plus shared-layout regressions after fixes. Do not promise a quantitative similarity score without a defined, executed comparison method. Pixel metrics are sensitive to fonts, rasterization, animation, and dynamic content; report those conditions when using them.

## Distinguish tolerant differences from exact equality

A tolerance-filtered zero does not mean identical pixels. Record the comparison method, color tolerance and anti-aliasing policy alongside its result. When exact decoded RGBA comparison is available, report it separately, including equality, differing-pixel count and the exact difference mask. If it was not run, say **not measured**, not identical.

Exact RGBA equality is equality of decoded channel values, not PNG file bytes, semantic fidelity or functional correctness. It includes alpha and potentially invisible RGB values. A large exact ratio can reflect a small color change over a large area. If a tolerant comparison reports zero while decoded pixels differ, flag the evidence for visual review and preserve both measurements; do not hide the difference or relax the gate. Continue reviewing source/target screenshots and exercising interactions.

## Functional checks

Exercise the meaningful local workflow: route links and direct loading, back/forward navigation where relevant, mobile menu, tabs, accordion open/close, filters, carousel boundaries, dialogs, keyboard activation/focus, and media controls. Confirm controls do what their labels promise.

Check runtime errors, failed requests/assets, missing font weights, horizontal overflow, and content clipped at small widths. If shared styles changed, inspect previously authored routes. Check responsive state changes by resizing, not only by opening separate screenshots.

Identify backend-dependent features explicitly. A local search over bundled data is different from a production search service; a form UI is different from delivery; a sign-in screen is different from authentication. Record actual connectivity and demo behavior without sending real submissions during observation unless authorized.

## Project checks

Read the project's scripts and use its lockfile/package manager. Run the real production build and appropriate lint/type checks. Do not invent `npm run check` when no such script exists. Record the exact command, outcome, and any existing failures.

Use tests for meaningful behavior or required project gates. Avoid assertions that merely mirror implementation classes. A visual clone does not need a new test framework just to restate static markup.

## Completion evidence

Keep these claims separate in the report:

| Claim | Required evidence |
| --- | --- |
| Implemented | Actual editable files and mapped routes |
| Builds successfully | Successful project build command |
| Visually compared | Source/local captures at documented matching conditions, with observed gaps |
| Interaction checked | Input/action and observed local result |
| Backend connected | Working integration evidence within the authorized scope |

Never upgrade a weaker claim to a stronger one. If browser verification is unavailable, deliver the implementation as pending visual comparison and list the missing source/local evidence. Persist the report and asset manifest even when work is partial.

## Final handoff

Report, in order: preview or run instructions; routes and implemented behaviors; representative desktop/mobile comparisons; checks actually run; intentional remix changes; unresolved visual, functional, and integration gaps. Link the evidence bundle so another agent can continue without repeating completed inspection.
