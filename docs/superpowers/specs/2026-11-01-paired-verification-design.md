# Paired live verification

Continue the existing Website Cloner, not a replacement or hosted crawler. User requested open-source implementation and real clone attempts in uulab-official/website-cloner.

## Approach
Reuse capture.mjs and compare.mjs in a new verify.mjs orchestrator. Separate invocations are already possible but easy to mislabel; duplicating browser logic would fragment safety and settling behavior. The selected approach keeps both existing CLIs unchanged and creates a reviewable HTML/JSON paired report. Selection is an implementation decision under the user's instruction to continue.

## Contract
Node >=22.12, no new dependencies. HTTP(S) URLs, no credentials. Same widths, height, color preference, state, executable, reduced-motion policy. Separate source/target click-and-scroll action files allow different selectors. Strict equality of recorded capture conditions before comparing. No resizing, no automatic semantic quality score, no implicit visual pass, no functional or touch-device parity claim. Diagnostics are warnings, capture/metadata/comparison failures are errors. Existing output ownership and input-containment protections apply.

Only observed public owner-authorized UULab services route is tested live. No forms, payments, logins, source bundles, TLS bypasses, or production mutations. Ordinary CI remains offline with local fixtures; live checks run via manual workflow or the dedicated validation branch. Upload evidence even on failure. Preserve old static-reference evidence and report the new attempt separately.
