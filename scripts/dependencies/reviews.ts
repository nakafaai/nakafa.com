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
    "Effect 4.1.2 is the latest release and the adopted cohort (EFFECT_COHORT_VERSION). 4.1.1 and 4.1.2 are patch releases with fixes only. The contracts lead the cohort: @nakafa/aksara-contracts 6.0.0 peers effect 4.1.2 exactly. Checked 7 November 2026.",
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
    "0.67.5",
    "Compiler patching moves with tsrs and Effect, and every rule is decided in packages/typescript-config/base.json, which Aksara's rule block matches (docs/adr/0021-rules.md). 0.67.5 is the adopted release: it patches tsrs 0.23.0-ts7.1.0-beta, which replaces the TypeScript package, and base.json decides the twelve rules that 0.64 to 0.67 add. Checked 7 November 2026.",
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
    "5.0.0",
    "nakafa.com declares 5.0.0, the newest release, which peers effect 4.1.2 exactly: the contracts lead the Effect cohort, and 5.0.0 divides every try-out exam's tracks into groups on one axis (year, grade, institution) with a group row in the catalog. Checked 8 November 2026.",
  ],
  [
    "tsrs@latest",
    "0.23.0-ts7.1.0-beta",
    "tsrs is the Rust port of the TypeScript 7.1 checker, pinned exactly to the release @effect/tsgo 0.67.5 patches. Every typecheck, the language server, and the source check's compiler API run on it. A new release lands with the @effect/tsgo release that supports it. Checked 7 November 2026.",
  ],
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
    "Runtime stays on the latest 1.6 patch (1.6.34, which fixes stateless OAuth linking and SAML, neither used here). 1.7 moves the MCP plugin that the agent sign-in uses (confect/auth/oauth.ts) to @better-auth/mcp, which depends on @better-auth/oauth-provider. That provider's schema declares a compound unique index, oauthClientResource [clientId, resourceId], and mergeSchema lets a plugin option rename a model or its fields but not drop an index. @convex-dev/better-auth 0.13.0, the only adapter that admits 1.7, throws on any unique index of more than one field (assertNoCompoundUniqueIndexes in src/client/adapter-utils.ts, called from create-schema.ts and withTableLevelUniqueFields), and its 0.13 upgrade guide states that apps can no longer act as an OAuth provider for that reason. So the agent sign-in has no supported 1.7 path on Convex until the adapter enforces compound unique indexes, which convex/better-auth#470 tracks. Checked 7 November 2026.",
  ],
  [
    "@convex-dev/better-auth@latest",
    "0.13.0",
    "The adapter stays on 0.12.6, the last release that admits Better Auth 1.6. 0.13.0 peers better-auth >=1.7.16 and refuses compound unique indexes, which @better-auth/oauth-provider declares, so the agent sign-in cannot move with it (see better-auth@latest). 0.12.7 also rewrites x-forwarded-host on every auth request to an exact trusted origin or CONVEX_SITE_URL, while the school hosts reach Better Auth through the x-forwarded-host that the web app's auth proxy sends (confect/auth/host.ts, ADR 0026); a move sends x-better-auth-forwarded-host instead and trusts the exact origin of each request. Checked 7 November 2026.",
  ],
  [
    "@types/node@26",
    "26.6.6",
    "The root, API and MCP manifests declare the Node 26 types (#1872): the scripts and tooling run on Node 26, and the API and MCP Workers run on workerd. The backend declares no Node types, so its Node actions on node.nodeVersion 24 (packages/backend/convex.json) gain no Node 26 API from this.",
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
