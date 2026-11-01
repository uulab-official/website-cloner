# Design QA — UULab services trial

## Findings

No actionable P0/P1/P2 finding remains within the recorded static-layout and local-interaction scope.

- **Resolved P2 — Open mobile menu lost text separation from the hero.** At 390 × 900, white hero copy showed through the navigation panel and collided with its links. The first implementation used a 95%-opaque surface and a nested backdrop filter inside the blurred header. Layer inspection confirmed the menu was stacked above the hero. The fix uses opaque white / `#0f172a` panel surfaces and removes the nested filter. [Before](docs/case-studies/uulab-services/evidence/states/menu-before/390x900/viewport.png) and [corrected capture](docs/case-studies/uulab-services/evidence/states/menu/390x900/viewport.png) were visually inspected. Every label is now clear. Closed-menu geometry is unchanged; local interaction checks pass.
- **Resolved evidence-label issue — cloud CSS viewport differs from stored JPEG dimensions.** Both pages report 1363 × 936 CSS px at DPR 1. Source files are 1357 × 932 pixels, local files 1348 × 926 pixels. The case report records both and excludes the provider-scaled JPEGs from numeric comparison.

## Comparison scope and artifacts

Source visual truth is the dated, script-stripped static reference under [`evidence/reference/`](docs/case-studies/uulab-services/evidence/reference/). It was built from the public source HTML/CSS/assets after direct headless HTTPS was blocked by certificate trust. Live desktop theme and FAQ observations are separately retained as cloud JPEGs. The target implementation is the editable example at `/services/`, with screenshots under [`evidence/local/`](docs/case-studies/uulab-services/evidence/local/).

| Comparison | CSS viewport / DPR | Source pixels | Implementation pixels | Combined input inspected |
| --- | --- | --- | --- | --- |
| Desktop full page, light | 1440 × 900 / 1 | 1440 × 7049 | 1440 × 7049 | [Side by side](docs/case-studies/uulab-services/evidence/comparisons/1440-full/side-by-side.png) |
| Desktop top, light | 1440 × 900 / 1 | 1440 × 900 | 1440 × 900 | [Side by side](docs/case-studies/uulab-services/evidence/comparisons/1440-top/side-by-side.png) |
| Tablet full page, light | 768 × 900 / 1 | 768 × 8945 | 768 × 8945 | [Side by side](docs/case-studies/uulab-services/evidence/comparisons/768-full/side-by-side.png) |
| Narrow top, light | 390 × 900 / 1 | 390 × 900 | 390 × 900 | [Side by side](docs/case-studies/uulab-services/evidence/comparisons/390-top/side-by-side.png) |
| Focused project card | Same desktop capture; x80, y4930 | 440 × 620 crop | 440 × 620 crop | [Side by side](docs/case-studies/uulab-services/evidence/comparisons/project-card/side-by-side.png) |

The compared PNGs use the same Chromium 134.0.6998.35 and system fonts; no density scaling, resizing, recoloring, or frame correction was applied. The focused card is a lossless same-coordinate crop. Desktop/tablet full-page evidence establishes overall composition; the top, narrow, and card views make title/body type, icons, navigation, and image details readable. At 390px the full pages differ in height because footer links wrap, so the CLI correctly refuses a full-page pixel comparison.

## Required fidelity surfaces

| Surface | Evidence and assessment |
| --- | --- |
| Fonts and typography | Same system font stack, Noto CJK fallback, 60px desktop / 36px narrow hero title. Korean glyphs, wrapping, hierarchy, small card text, and used Font Awesome faces inspected. Missing-font setup captures were discarded before comparison. |
| Spacing and layout rhythm | Nine section tops/heights match to recorded 0.01 CSS px at 1440/768/390. Header, grid, CTA, and card proportions match. The 390px footer deliberately grows by 8px to keep links readable. No overflow in 320/390/768/1024/1440px functional checks. |
| Colors and tokens | Hero/CTA gradients, service surfaces, body text, active navigation, badges, and card backgrounds match the static light reference in combined views. Dark theme is exercised separately, without a full-page parity claim. The open mobile panel deliberately uses an opaque surface for readability. |
| Image quality and assets | Real local logo and three 1600 × 900 project covers retain source crop/ratio. The focused card shows correct subject, rounded crop, sharp text, and badges. Original Font Awesome assets are used; no generated or placeholder art substitutes. |
| Copy and content | Normalized rendered text matches at all three measured widths; all nine sections and four FAQ questions are present. Content remains editable in `src/content.js`. No build instructions leak into the product UI. |

## Browser-rendered verification

The local implementation was opened through the cloud preview at `/services/`. [`local-cloud-desktop-top.jpg`](docs/case-studies/uulab-services/evidence/local-cloud-desktop-top.jpg) is the rendered implementation screenshot, with measured CSS viewport 1363 × 936/DPR 1 and stored raster 1348 × 926. Desktop light/dark toggle, first FAQ expansion/collapse, and back-to-top were exercised. Final scroll position was 0 and theme was light. No application console errors were observed; extension metadata-delivery errors are explicitly separated in [`cloud-verification.json`](docs/case-studies/uulab-services/evidence/cloud-verification.json).

Local automated browser checks additionally cover keyboard FAQ controls, theme persistence, mobile navigation focus/Escape/route/resize behavior, all local images, and five responsive widths. Width-only captures are not physical touch-device emulation.

## Comparison history

1. After installing the required Korean fonts, the implementation was compared with the static reference. Desktop/tablet full-page and narrow top-view comparisons reported zero changed pixels at Pixelmatch threshold 0.1 (antialiasing differences excluded). This is diagnostic evidence, not a semantic fidelity score.
2. Final root review opened the combined full/top/card comparisons and the separate open-menu state. It found the P2 text-overlap issue above and withheld acceptance.
3. The menu's translucent surface/filter was corrected. A new 390 × 900 menu capture was opened and inspected; the overlapping hero text is gone and navigation remains readable. The example was rebuilt and all nine behavior tests passed. The final full gate also passed 39 tool tests and nine demo tests with zero skips. New closed-page captures were collected at all three comparison widths after this correction.

## Open questions and expected deviations

- Original mobile menu JavaScript and source animations were not observed live. Their parity remains outside the verified scope even after local behavior passes.
- The narrower footer's extra 8px is intentional. Source dark-theme quirks are retained.
- Other routes and contact/backend behavior are outbound or outside scope.
- The passing result applies to the explicitly scoped static visual reconstruction and local behaviors; it is not certification of complete live-site parity.

## Implementation checklist

- [x] Inspect source and rendered implementation together at matched dimensions.
- [x] Inspect a focused, readable asset/type region.
- [x] Separate cloud evidence dimensions from matched PNG dimensions.
- [x] Resolve, recapture, and visually inspect the P2 open-menu issue.
- [x] Run the final repository check after the correction.

## Follow-up polish

No unrelated visual redesign is requested. A future iteration can extend live mobile/motion evidence and physical-device coverage; this trial must not claim those checks already happened.

final result: passed
