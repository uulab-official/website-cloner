# Exact pixel evidence

Continue the approved Website Cloner work. The existing tolerant comparator can report zero while a translucent menu visibly differs. Keep its existing threshold and exit semantics, but show independent decoded RGBA8 equality and a lossless difference mask. Do not turn pixel counts into a fidelity/functional score.

Approach: additive local Node ESM diagnostics rather than replacing pixelmatch or adding a hosted service. Alternatives rejected: threshold=0 still applies perceptual/alpha treatment; only a README caveat does not inform people inspecting generated reports. This is the implementer's bounded choice under the request to continue, not a separate user-approved design decision.

Exact measurements count a pixel if any decoded RGBA8 channel differs (including alpha and RGB under zero alpha). Report count/ratio, maximum and mean absolute channel deltas and bounds. Different PNG encodings may decode identically. No resizing, masking of source content, threshold relaxation or new dependencies. A black/white exact-diff.png is derived evidence, never a replacement capture.

Expose metrics in compare JSON/CLI, paired HTML/JSON and suite HTML/JSON. Tolerant zero plus nonzero exact differences requires review. Old reports without metrics remain readable as not measured, never identical. Malformed metrics fail closed. Only an explicitly requested existing tolerant threshold gates execution.

Do not change source-site UI in this increment. FAQ scrolling/header differences and the intentional opaque menu remain recorded. Source/target evidence comes from fresh authorized UULab captures, with historical replay clearly labelled when used. Run complete CI and preserve failure diagnostics. No fonts or credentials in delivered artifacts.
