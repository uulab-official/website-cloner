# Scrollbar fidelity and viewport evidence

Continue the authorized UULab clone work from main `0cf11fb`.
Separate requested screenshot dimensions, actual layout viewport and real content overflow. A reserved scrollbar is not horizontal overflow. Preserve conservative screenshot allocation limits, actual overflow, raw captures, existing pixel thresholds and legacy report readability.
Observe source scrollbar rules before editing the example. Reconstruct only measured styles; never shrink screenshots or hide source scrollbars in fidelity evidence. Temporary CSS overrides are diagnostic interventions only and labeled separately.
The observed external-stylesheet initialization problem must be tested with real HTTP loading, fresh contexts and both `/` and `/services/` HTML entrypoints. Establish early scrollbar creation consistently without changing viewport requests or rewriting source responses in paired captures.
Use Node 22.12+, current locked dependencies and all three Playwright engines. No source-site changes, submissions, credential capture, dependency changes or actual Safari/device claims. Repeated-engine executions do not inflate unique test counts.
