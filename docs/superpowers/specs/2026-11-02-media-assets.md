# CSS and HTML media asset observations

Continue the existing local toolkit without a hosted service or new dependencies. A bounded, read-only browser collector records computed CSS background images (including generated ::before/::after) and video/audio currentSrc, src, poster and source declarations. It does not play media, call load(), fetch URLs, change DOM or infer file permissions.

The offline observer accepts this optional versioned extension, parses URL-bearing CSS values, deduplicates URL candidates while retaining roles/selectors/viewports, and distinguishes declared resources from selected currentSrc. MIME type, local path, rights, intrinsic dimensions and playback remain unknown unless independently observed; geometry is not intrinsic size. Old capture bundles remain readable but explicitly report that extended asset coverage was not recorded. Truncated and unsupported values generate notices, not fabricated URLs. Invalid extension metadata fails before writing.

No font binaries, source bundles or downloaded assets are included. Shadow roots, frames, masks, border images, canvas, fonts and playback are out of scope. Scope is sampled light-DOM computed values, not a complete network or CSS audit. Existing screenshot comparison semantics and app source remain unchanged.
