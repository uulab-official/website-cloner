# Website Cloner v0.1

## Intent

Publish an open-source, reusable website recreation skill in `uulab-official/website-cloner`, inspired by JCodesMore/ai-website-cloner-template, and demonstrate it against a real public webpage.

## Design decisions

Use a portable `website-clone` skill plus optional Node.js capture/comparison tools. Retain the upstream Map → Observe → Build → Compare workflow, framework independence, and MIT attribution. A complete fork would impose Next.js and duplicate boilerplate; a prompt-only adaptation would leave the requested reproducible trial unsupported. This package combines an independently installable skill with executable evidence tooling.

Existing projects keep their stack. Brand remix applies only when requested. Browser observations determine layout and behavior. The skill is useful in Codex and Claude without a paid scraping API. An agent and browser runtime are still required for implementation; the CLI does not generate a whole application by itself.

## Real trial

Rebuild `https://uulab.co.kr/services/` as an isolated editable Vite frontend. Record desktop, mobile, theme, menu, and FAQ states. Keep other routes as explicit outbound source links. Use the publicly loaded logo, project imagery and properly attributed icon assets locally. No form submissions, credentials, analytics, or backend reconstruction.

## Deliverables and acceptance

- A validated, self-contained `skills/website-clone` directory with a Claude bridge and install instructions.
- A capture CLI that creates matched viewport screenshots, DOM-derived observations, and runtime diagnostics.
- A PNG comparison CLI that refuses silent dimension changes and reports changed-pixel ratios as diagnostic evidence, not a fidelity certification.
- A local example with working theme, mobile navigation, FAQ, and meaningful local browser tests.
- A case study with actual commands/results, representative source/local comparisons, route scope, asset provenance, and precise remaining differences.
- CI that validates the skill, tests the tools, builds the example and checks its browser interactions without contacting the live source.

## Constraints

Node.js 22.12+, pinned dependencies, no paid services, no source production bundles, no hidden analytics, no claims of backend parity or universal pixel-perfect cloning. User explicitly authorized publishing to the named public GitHub repository. Cloudflare-compatible static output is a consequence of the example, not a mandatory deployment or cloud service.
