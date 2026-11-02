# Scroll progress and back-to-top fidelity

Continue the authorized UULab services reconstruction; keep the existing Node ESM/Vite stack and local evidence tooling. Source inspection at 390/768/769/1440px found a fixed, left-origin 4px progress bar, gradient #2563eb to #8b5cf6, z-index 100, and a 48px back-to-top control 24px from the bottom/right, visible only beyond scrollY 300. The clone omits the bar and overrides mobile offsets to 20px.

Implement a decorative, pointer-transparent progress element in authored markup, hidden without JavaScript. Reuse the existing requestAnimationFrame scheduler for scrolling and viewport changes; observe body/root size for layout changes and retain toggle/load/resize fallback. Clamp progress to [0,1], use zero for a non-scrollable document, and initialize accurately on pageshow. Keep keyboard return-to-main and header protection unchanged.

Approaches: a CSS scroll timeline would add a second compatibility path; an independent scroll loop duplicates existing work. Choose the existing scheduler with ResizeObserver and no dependencies. The builder owns naming, but the test hook is [data-scroll-progress].

Rulings: do not reproduce the source's initially uninitialized full-width bar; initialize to zero at the top. Keep the 8px legal-link row gap and readable wrapping rather than change content/layout merely to satisfy equal full-page dimensions. Keep all comparison thresholds unchanged. Neither a completed workflow nor a pixel ratio establishes site/functional equality.

Evidence: run full npm run check; capture the authorized source and production clone afresh; compare full pages without resizing. Preserve dimension_mismatch and exit code 1 as review-required evidence. No font files, credentials, source bundles or real form submissions in artifacts. Browser coverage remains Chromium on Linux; do not claim real-device coverage.
