# Verification suites

Continue the authorized website-cloner implementation from `1775338` without changing its portable skill or authored example. Add a small manifest-driven coordinator around the existing `verify.mjs`, not a new browser engine or hosted service.

## Goals and choices

A single JSON file describes named route/state pairs, widths, actions and optional pixel thresholds. Run each case serially in its own evidence directory, continue after failures, and publish an offline HTML index plus machine-readable JSON. Never turn an absent threshold, missing rows, failed child process or incomplete report into a pass. Preserve the distinction between execution success and visual gating. Functional parity remains unverified.

The assistant selected a thin coordinator rather than refactoring capture internals or building a web UI: it retains the proven CLI and avoids new dependencies. This is an implementation decision under the user's instruction to continue, not a separately approved product spec.

## Constraints

Node.js 22.12+; no new dependencies; local-only deterministic normal CI; explicitly requested live UULab evidence in a separate workflow. Do not submit forms, copy production bundles or bypass TLS. HTTP(S) URLs cannot carry embedded credentials. Actions are only click/scroll; users must authorize destinations and actions. Network isolation/SSRF protection is not claimed; this remains a trusted local developer CLI, not a public URL service.

Strict manifest keys, safe unique IDs, bounded inputs (20 cases, 60 viewport pairs, 50 actions per side), preserved input files on overwrite, no shell evaluation, escaped report content, no remote report assets. Inline actions avoid relative-path ambiguity. Origin overrides support local CI; explicitly document redirects/subresources are not origin-isolated.

## Acceptance

Reject malformed configuration before touching output. Dry-run performs no browser/network/output work. Selected cases are reported explicitly. Keep individual evidence and diagnose failed children. Cover real local browser captures and a failed case followed by a successful one. Re-run live default/menu/dark/FAQ states and retain observed differences, not an invented similarity score.
