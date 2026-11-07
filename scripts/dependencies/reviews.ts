import { AI_SDK_COHORT } from "#scripts/dependencies/policy";

/**
 * The upstream release that was last reviewed for each held dependency, with the
 * reason the hold stays. `bun run bump-deps` reports a registry whose latest
 * release is newer than its review, so a new release is reviewed before it lands.
 */
export const REGISTRY_REVIEWS = [
  [
    "alchemy@latest",
    "2.0.0-beta.85",
    "2.0.0-beta.85 is the first release past beta.84 and runs on Effect 4.1, so ALCHEMY_COHORT names it in place of the preview tarballs. Its breaking changes touch AWS, GCP, the Domain platform, Cloudflare.state options and GitHub Ruleset props, none of which the Nakafa stack uses in the changed form. Checked 7 November 2026.",
  ],
  [
    "effect@latest",
    "4.1.2",
    "Effect 4.1.2 is the latest release and the adopted cohort (EFFECT_COHORT_VERSION). 4.1.1 and 4.1.2 are patch releases with fixes only. The contracts lead the cohort: @nakafa/aksara-contracts 4.1.1 peers effect 4.1.2 exactly. Checked 7 November 2026.",
  ],
  [
    "@effect/platform-node@latest",
    "4.1.2",
    "@effect/platform-node follows the Effect cohort and moves with effect@latest; 4.1.2 is the adopted release.",
  ],
  [
    "@effect/platform-node-shared@latest",
    "4.1.2",
    "@effect/platform-node-shared follows the Effect cohort and moves with effect@latest; 4.1.2 is the adopted release.",
  ],
  [
    "@effect/vitest@latest",
    "4.1.2",
    "@effect/vitest follows the Effect cohort and moves with effect@latest; 4.1.2 is the adopted release.",
  ],
  [
    "@effect/ai-openai-compat@latest",
    "4.1.2",
    "@effect/ai-openai-compat follows the Effect cohort and moves with effect@latest; 4.1.2 is the adopted release.",
  ],
  [
    "@effect/ai-openrouter@latest",
    "4.1.2",
    "@effect/ai-openrouter follows the Effect cohort and moves with effect@latest; 4.1.2 is the adopted release.",
  ],
  [
    "@effect/platform-bun@latest",
    "4.1.2",
    "@effect/platform-bun follows the Effect cohort and moves with effect@latest; 4.1.2 is the adopted release.",
  ],
  [
    "@confect/core@latest",
    "10.5.0",
    "Confect moves with the Effect cohort (CONFECT_COHORT_VERSION). 10.5.0 is the latest release and the adopted one: its core, server, client, CLI and test packages admit effect ~4.1.0, which holds 4.1.2.",
  ],
  [
    "@effect/tsgo@latest",
    "0.67.4",
    "Compiler patching moves with TypeScript and Effect, and every rule is decided in packages/typescript-config/base.json, which Aksara's rule block matches (docs/adr/0021-rules.md). The patch stays on 0.63.0: 0.64 and 0.65 add the brandedSchemaClasses option and new diagnostics (effectSucceedWithUndefined, matchToResultOrOption, matchBooleanToIsSuccess, resultMatchToFromResult, mapSomeCatchNoSuchElement, suspendFailToFailSync, effectTryWithoutCatch, globalJson, provideMergeAllToArray, typeUnionToSchemaUnion, yieldInCallArgument), each of which base.json decides in both repositories in one change. 0.66 and 0.67 add CLI proxy commands this repository does not use. Checked 7 November 2026.",
  ],
  [
    "vitest@latest",
    "5.1.0",
    "The Effect 4 test adapter requires Vitest 5; @effect/vitest 4.1.2 admits >=5.0.0 <6.0.0.",
  ],
  [
    "@vitest/coverage-istanbul@latest",
    "5.1.0",
    "Coverage must match the supported Vitest runner.",
  ],
  [
    "@vitest/ui@latest",
    "5.1.0",
    "The test UI must match the supported Vitest runner.",
  ],
  [
    "@nakafa/aksara-contracts@latest",
    "4.1.0",
    "nakafa.com declares 4.1.0, the newest release, which peers effect 4.1.0 exactly: 3.0.0 moved the contracts onto effect/crypto, and 4.0.0 reads a typed number with any decimal separator and Arabic-Indic digits.",
  ],
  ["typescript@latest", "7.0.2", "The native compiler is pinned exactly."],
  [
    "ai@latest",
    "7.0.164",
    "AI SDK packages move as one reviewed cohort. 7.0.164 is the latest release and the adopted one: @convex-dev/agent 0.7.9 peers ai ^7.0.129, and the gateway module (confect/gateway) typechecks against it. Checked 7 November 2026.",
  ],
  [
    "@convex-dev/ai-sdk-provider@latest",
    AI_SDK_COHORT["@convex-dev/ai-sdk-provider"],
    "The Convex AI gateway provider moves with the AI SDK cohort; each bump rechecks the gateway module (confect/gateway).",
  ],
  [
    "better-auth@latest",
    "1.7.18",
    "Runtime stays on the latest 1.6 patch (1.6.33) while @convex-dev/better-auth stays on 0.12.6, the last adapter that admits it. 1.7 needs adapter 0.13, whose route handler rewrites the request origin, so it moves together with that adapter. Checked 7 November 2026.",
  ],
  [
    "@convex-dev/better-auth@latest",
    "0.13.0",
    "The adapter stays on 0.12.6. 0.12.7 and 0.13.0 rewrite x-forwarded-host on every auth request to an exact trusted origin or CONVEX_SITE_URL, while the school hosts reach Better Auth only through the x-forwarded-host the web app's auth proxy sends (confect/auth/host.ts, ADR 0026). The move to 0.13 changes that proxy to x-better-auth-forwarded-host and the trusted origins to the exact origin of each request in one change, together with Better Auth 1.7. Checked 7 November 2026.",
  ],
  [
    "@types/node@24",
    "24.19.2",
    "Declarations stay on the Node 24 line while Convex runs the backend's Node actions on node.nodeVersion 24 (packages/backend/convex.json), so the types never offer an API that runtime lacks. They move to 26 with that runtime, once a dev deployment runs it.",
  ],
  [
    "node@26",
    "26.13.0",
    "Node 26 is the Active LTS line since 28 October 2026, and the tooling, CI and devEngines run it. Convex Node actions stay on 24 until a dev deployment proves 26.",
  ],
  [
    "react-doctor@latest",
    "0.9.18",
    "The local scanners move as one reviewed cohort. The doctor script installs only releases older than a day, so it takes a release once that release has settled. 0.9.18 narrows existing rules to reduce false positives and adds the opt-in --scope contextual mode, which this repository does not use.",
  ],
];
