# Browser-aware paired capture

Extend `capture`, `verify` and `verify:suite` with `--browser chromium|firefox|webkit`, defaulting to Chromium. One engine applies to both sides and the whole suite; compare different engines in separate output runs rather than treating cross-engine images as compatible. Preserve the manifest schema, all authored example files, lockfile, thresholds, and no-TLS-bypass policy.

Record the requested engine and actual engine/version. Reject invalid engine names, Firefox/WebKit with a Chromium executable, and mismatches between requested and observed engines before comparing images. Invalid configuration must not replace output. Missing engines fail explicitly, never fall back. Reports show the engine and preserve existing exact/tolerant diagnostics and functional/motion limitations. Legacy reports without engine fields are unmeasured, not an engine verification.

Test CLI preflight, metadata consistency, suite propagation, real fixture success/failure in all three engines, and the existing full gate. Run a fresh authorized UULab source/implementation suite in each engine. These are Linux Playwright engines, not physical devices or actual Safari.
