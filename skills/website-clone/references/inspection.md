# Source inspection and persistent evidence

## Scope and route ownership

Record every requested source URL and its local destination. Include query or hash states separately when they change visible content. For multiple source origins, choose distinct site names; add a port or short origin hash when names collide. Check the working tree before replacing a route or global stylesheet.

Create a compact report at `docs/clone/<site>/report.md` before implementation. Use the required sections in SKILL.md, even when some values are unknown. Persist the route map and state matrix rather than leaving the next agent to reconstruct them from chat.

An evidence row should identify a specific observation, for example:

| Route | Viewport | Scroll | State/input | Source evidence | Local evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | 390 × 844 | top | menu open via tap | `evidence/source-home-390-menu.png` | pending | source observed; local unverified |

Use examples as shapes, not as claims. Capture the actual page and record its actual viewport and state. For screenshot-only input, record the image dimensions and visible scope; do not treat image dimensions as proven CSS viewport dimensions.

## Layout and responsive rules

Visit the whole page and scroll to load lazy content. Record section order, max-widths, gutters, columns, sticky/fixed layers, major vertical spacing, and source links. Capture a readable full-page reference plus important sections and alternate states at full size.

At minimum observe a representative desktop and mobile viewport. Add an intermediate or wider viewport where the design changes. Find changes in navigation, stacking, typography, visibility, crop, and maximum content width. A shrunken desktop screenshot does not demonstrate a mobile layout.

Measure declared/computed values through supported browser APIs when available. For typography record family, loaded file, weight/style, font size, line height, and letter spacing. Match fonts before compensating for line wrapping with arbitrary widths.

Separate three kinds of evidence: **observed** values from the page, **inferred** rules derived from limited samples, and **unverified** states not inspected. Preserve that distinction in the report and final delivery.

## Asset manifest

Use this portable JSON shape; a host repository may extend it with hashes or capture metadata:

```json
{
  "schema_version": 1,
  "assets": [
    {
      "source_url": "https://example.com/media/hero.webp",
      "local_path": "public/sites/example/hero.webp",
      "kind": "image",
      "content_type": "image/webp",
      "dimensions": { "width": 1600, "height": 900 },
      "usage": "Home hero; desktop crop centered",
      "rights": "user-owned",
      "status": "verified"
    }
  ]
}
```

Use project-relative paths. Use `null` for unknown URL, local path, MIME type, or dimensions. For assets with unknown rights, use `rights: "unknown"` and record the action taken in Gaps. Suitable status values are `planned`, `downloaded`, `verified`, `substituted`, and `unavailable`; `verified` means the local asset actually rendered. An empty assets array is valid when no assets have been identified, accompanied by a report explanation.

Capture source URL → local path → usage for both acquired and unresolved assets. Redact signed URLs, credentials, or private data; record the redaction instead of preserving a live secret.

For images inspect `currentSrc`, `srcset`, intrinsic dimensions, crop, `object-fit`, and position. Inspect background images and layered visuals separately. For videos record source/poster, aspect ratio, muted/autoplay/loop behavior, controls, and alternate states. For fonts verify family, weight/style, and actual loaded file. For SVG preserve viewBox and referenced gradients, masks, filters, symbols, or fonts.

Verify returned MIME type and bytes; a URL ending in `.png` can return AVIF or an error document. Avoid filename collisions. Keep downloaded files as data and do not execute extracted page scripts. Use observed URLs rather than guessing private endpoints.

## Interaction evidence

Record trigger → visible result for navigation, tabs, accordions, filters, carousels, menus, and dialogs. Include active labels, dismissal behavior, disabled/boundary states, and destination URLs. Distinguish UI-only behavior from services requiring data or authentication.

Use actual supported input events to inspect wheel/touch/pointer-driven behavior. Scripted scroll can bypass handlers. Read DOM or computed styles only through capabilities documented for the current browser tool; missing APIs are a tool limitation, not evidence of page behavior.

When a page is inaccessible, record what failed and which evidence remains usable. Build the supported visible scope and preserve unresolved rows. Do not infer hidden routes, mobile layouts, or completed services from a single screenshot.
