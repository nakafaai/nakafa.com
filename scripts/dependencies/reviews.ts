import { AI_SDK_COHORT } from "#scripts/dependencies/policy";

/**
 * The upstream release that was last reviewed for each held dependency, with the
 * reason the hold stays. `bun run bump-deps` reports a registry whose latest
 * release is newer than its review, so a new release is reviewed before it lands.
 */
export const REGISTRY_REVIEWS = [
  [
    "mermaid@latest",
    "12.2.0",
    "Mermaid 12 requires Safari 17.4 (recorded when this hold was made; not re-measured on 25 October 2026), while Nakafa keeps the Safari 16.4 floor that Vite 8.3.5 builds for by default (its baseline-widely-available target lists safari16.4). The hold holds while both are true.",
  ],
  [
    "effect@latest",
    "4.1.0",
    "Effect 4.1.0 is the latest release and is reviewed here, but the cohort stays on 4.0.5 (EFFECT_COHORT_VERSION). 4.1.0 replaces effect/Crypto with the effect/crypto services (Digest, SecureRandom, Signature, KeyFormat, Mac, Aead) and no longer bundles crypto in the runtime layers. Every published @nakafa/aksara-contracts (1.0.0, 1.0.1 and 2.0.0) peers effect 4.0.5 exactly, and its dist/hash/digest.js calls Crypto.make from effect when the module loads, so on 4.1 every contracts import fails. nakafa.com therefore moves to 4.1.0 in the change that adopts contracts 3.0.0, the release built on 4.1 (nakafaai/aksara#497), which follows the contracts 2.0 adoption (#1434, #1436); that change is #1524. Checked 30 October 2026.",
  ],
  [
    "@effect/platform-browser@latest",
    "4.1.0",
    "@effect/platform-browser follows the Effect cohort. Its 4.1.0 release peers effect ^4.1.0, so it moves with effect@latest and stays on 4.0.5 until the cohort moves.",
  ],
  [
    "@effect/platform-node@latest",
    "4.1.0",
    "@effect/platform-node follows the Effect cohort. Its 4.1.0 release peers effect ^4.1.0, so it moves with effect@latest and stays on 4.0.5 until the cohort moves.",
  ],
  [
    "@effect/platform-node-shared@latest",
    "4.1.0",
    "@effect/platform-node-shared follows the Effect cohort. Its 4.1.0 release peers effect ^4.1.0, so it moves with effect@latest and stays on 4.0.5 until the cohort moves.",
  ],
  [
    "@effect/vitest@latest",
    "4.1.0",
    "@effect/vitest follows the Effect cohort. Its 4.1.0 release peers effect ^4.1.0, so it moves with effect@latest and stays on 4.0.5 until the cohort moves.",
  ],
  [
    "@effect/ai-openai-compat@latest",
    "4.1.0",
    "@effect/ai-openai-compat follows the Effect cohort. Its 4.1.0 release peers effect ^4.1.0, so it moves with effect@latest and stays on 4.0.5 until the cohort moves.",
  ],
  [
    "@effect/ai-openrouter@latest",
    "4.1.0",
    "@effect/ai-openrouter follows the Effect cohort. Its 4.1.0 release peers effect ^4.1.0, so it moves with effect@latest and stays on 4.0.5 until the cohort moves.",
  ],
  [
    "@effect/tsgo@latest",
    "0.63.0",
    "Compiler patching moves with TypeScript and Effect. Every rule is decided in packages/typescript-config/base.json, and docs/adr/0021-rules.md records each decision. 0.57 adds the experimental tsrs build and 0.59 adds the effect-tsgo tsc, tsrs and oxlint proxy commands, which this repository does not use: it patches the installed compiler. 0.61 adds flatMapIdentityToFlatten, 0.62 mapConstToAs, and 0.63 failCauseToConstructor and manualMetricTapToTrack, each a style suggestion by default that base.json sets to error, and the opt-in mapMapErrorToMapBoth, which base.json keeps off as upstream does. 0.63 also names the catch variant in two messages and builds quick-fix references from the file's imports. 0.63.0 is the latest release and supports TypeScript 7.0.2.",
  ],
  ["vitest@latest", "5.0.5", "The Effect 4 test adapter requires Vitest 5."],
  [
    "@vitest/coverage-istanbul@latest",
    "5.0.5",
    "Coverage must match the supported Vitest runner.",
  ],
  [
    "@vitest/ui@latest",
    "5.0.5",
    "The test UI must match the supported Vitest runner.",
  ],
  [
    "@nakafa/aksara-contracts@latest",
    "2.0.0",
    "2.0.0 replaces the question and try-out contracts with the assessment snapshot, and nakafa.com adopts it in the try-out engine train (#1434, #1436), so this repository stays on 1.0.0 until that train lands. 2.0.0 still peers effect 4.0.5 exactly, as 1.0.0 does.",
  ],
  ["typescript@latest", "7.0.2", "The native compiler is pinned exactly."],
  [
    "ai@latest",
    "7.0.153",
    "AI SDK packages move as one reviewed cohort. 7.0.140 stays: 7.0.141, 7.0.142, 7.0.147 and 7.0.152 each fail the backend typecheck with TS2590 in confect/nina (21 errors each, measured on 25 October 2026 with @convex-dev/agent 0.7.8), and 7.0.140 passes. 7.0.153 is the latest release and becomes eligible at 2026-10-25 17:57 UTC; re-test it then. Its release notes change the streamed input of OpenAI custom tools and the workflow telemetry context, and Nakafa uses neither.",
  ],
  [
    "@convex-dev/ai-sdk-provider@latest",
    AI_SDK_COHORT["@convex-dev/ai-sdk-provider"],
    "The Convex AI gateway provider moves with the AI SDK cohort; each bump rechecks the gateway module (confect/gateway).",
  ],
  [
    "better-auth@latest",
    "1.7.14",
    "@convex-dev/better-auth 0.12.6, the latest adapter, still declares the peer range >=1.6.11 <1.7.0 (checked 30 October 2026), so runtime stays on the latest 1.6 patch (1.6.33) until the adapter opens 1.7. Its optional Vitest peer stops at 4, but only unused test-utils import Vitest; Nakafa auth runtime tests pass on 5.",
  ],
  [
    "@convex-dev/better-auth@latest",
    "0.12.6",
    "The adapter defines the accepted Better Auth peer range. 0.12.6 keeps >=1.6.11 <1.7.0 and convex-helpers ^0.1.128.",
  ],
  [
    "@biomejs/biome@latest",
    "2.6.4",
    "Formatting is reviewed as one cohort with Ultracite. Biome stays on 2.5.15. Ultracite 8.1.0 peers Biome ^2.6.2 and renames useSortedClasses to useTailwindSortedClasses, so the 2.6 line loads now, but the cohort also sorts classes in Tailwind CSS v4 order and turns on the rules that Biome 2.6 made stable. Measured on 30 October 2026 with Biome 2.6.4 and Ultracite 8.1.0: 1,620 findings in about 550 files, among them 733 class lists to re-sort in 290 files, 410 regular expressions without the unicode flag, 177 unnamed capture groups, 101 hook factory components (noComponentHookFactories) and 83 imports after code. That change touches most of the files that the open pull requests touch, so the hold lifts in its own change: one that applies Ultracite's fixes, clears the remaining findings by hand, and lands right after a merge train, when the fewest pull requests are open.",
  ],
  [
    "ultracite@latest",
    "8.1.0",
    "Ultracite 8.1 moves with Biome 2.6, as the Biome entry describes: it renames the class sort rule, sorts the class lists of cva variants, turns on the newly stable Biome rules that match its Oxlint presets, and formats YAML and SCSS. Its ESLint, Oxlint, Oxfmt and Zed changes do not apply to this Biome setup.",
  ],
  ["@types/node@24", "24.19.2", "Declarations remain on the Node 24 line."],
  ["node@24", "24.22.2", "The repository supports the Node 24 runtime line."],
  [
    "react-doctor@latest",
    "0.9.18",
    "The local scanners move as one reviewed cohort. The doctor script installs only releases older than a day, so it takes a release once that release has settled. 0.9.18 narrows existing rules to reduce false positives and adds the opt-in --scope contextual mode, which this repository does not use.",
  ],
];
