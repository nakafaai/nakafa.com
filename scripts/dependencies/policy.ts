import { Schema } from "effect";

/** The exact specs one reviewed dependency may declare. */
const ApprovedSpecsSchema = Schema.Union([
  Schema.Struct({ allowed: Schema.NonEmptyArray(Schema.String) }),
  Schema.Struct({ approved: Schema.String }),
]);

/** The manifests that must declare one reviewed dependency. */
const DeclarationOwnersSchema = Schema.Union([
  Schema.Struct({ declarationPaths: Schema.Array(Schema.String) }),
  Schema.Struct({ minimumDeclarations: Schema.Finite }),
]);

const DependencyNameSchema = Schema.Struct({ dependency: Schema.String });

type DependencyHold = typeof ApprovedSpecsSchema.Type &
  typeof DeclarationOwnersSchema.Type &
  typeof DependencyNameSchema.Type;

/** The exact package manager the root manifest pins for every checkout and CI job. */
export const PACKAGE_MANAGER = "pnpm@11.28.5";
/**
 * The exact Node release the root manifest downloads. A workflow job that does
 * not check out the repository cannot read the manifest, so it names the same
 * release and the workflow checks compare it with this value.
 */
export const NODE_RUNTIME_VERSION = "24.21.0";
const CONTRACT_PACKAGE_VERSION = "0.48.7";
/** Effect and its platform and test packages move as one exact cohort. */
export const EFFECT_COHORT_VERSION = "4.0.2";
/**
 * Effect packages that only dependencies declare: the Confect CLI's platform
 * packages and the Confect server's AI providers. An override keeps each one
 * in the exact cohort.
 */
export const EFFECT_COHORT_OVERRIDES = [
  "@effect/ai-openai-compat",
  "@effect/ai-openrouter",
  "@effect/platform-node",
  "@effect/platform-node-shared",
] as const;
/** The Vitest runner, coverage, and UI packages move as one catalog cohort. */
export const VITEST_COHORT_VERSION = "5.0.3";
/**
 * The AI SDK core and the Convex AI gateway provider move as one catalog
 * cohort, and each bump rechecks the gateway module's provider contracts
 * (confect/gateway). The provider brings its own provider packages, so the
 * lockfile holds more than one version of @ai-sdk/provider and
 * @ai-sdk/provider-utils.
 */
export const AI_SDK_COHORT = {
  "@convex-dev/ai-sdk-provider": "0.2.1",
  ai: "7.0.136",
} as const;

export const DEPENDENCY_HOLDS: readonly DependencyHold[] = [
  { approved: "19.3.0", dependency: "react", minimumDeclarations: 1 },
  { approved: "19.3.0", dependency: "react-dom", minimumDeclarations: 1 },
  { approved: "19.3.0", dependency: "@types/react", minimumDeclarations: 1 },
  {
    approved: "19.3.0",
    dependency: "@types/react-dom",
    minimumDeclarations: 1,
  },
  { approved: "11.17.2", dependency: "mermaid", minimumDeclarations: 1 },
  {
    approved: "catalog:",
    dependency: "effect",
    minimumDeclarations: 1,
  },
  {
    approved: "catalog:",
    dependency: "@effect/platform-browser",
    minimumDeclarations: 1,
  },
  {
    approved: "catalog:",
    dependency: "@effect/platform-node",
    minimumDeclarations: 1,
  },
  {
    approved: "catalog:",
    dependency: "@effect/vitest",
    minimumDeclarations: 1,
  },
  { approved: "catalog:", dependency: "vitest", minimumDeclarations: 1 },
  {
    approved: "catalog:",
    dependency: "@vitest/coverage-istanbul",
    minimumDeclarations: 1,
  },
  { approved: "catalog:", dependency: "@vitest/ui", minimumDeclarations: 1 },
  {
    approved: "0.51.1",
    dependency: "@effect/tsgo",
    minimumDeclarations: 1,
  },
  {
    allowed: ["7.0.2", "catalog:", "npm:typescript@7.0.2"],
    dependency: "typescript",
    minimumDeclarations: 1,
  },
  { approved: "16.4.0", dependency: "next", minimumDeclarations: 1 },
  {
    approved: "16.4.0",
    dependency: "@next/third-parties",
    minimumDeclarations: 1,
  },
  { approved: "1.46.0", dependency: "convex", minimumDeclarations: 1 },
  { approved: "catalog:", dependency: "ai", minimumDeclarations: 1 },
  {
    approved: "catalog:",
    dependency: "@convex-dev/ai-sdk-provider",
    minimumDeclarations: 1,
  },
  {
    approved: "1.6.33",
    dependency: "better-auth",
    minimumDeclarations: 1,
  },
  { approved: "1.6.33", dependency: "auth", minimumDeclarations: 1 },
  {
    approved: "0.12.5",
    dependency: "@convex-dev/better-auth",
    minimumDeclarations: 1,
  },
  {
    approved: CONTRACT_PACKAGE_VERSION,
    declarationPaths: [
      "apps/www/package.json",
      "packages/backend/package.json",
      "packages/contents/package.json",
      "packages/email/package.json",
      "packages/internationalization/package.json",
      "packages/seo/package.json",
    ],
    dependency: "@nakafa/aksara-contracts",
  },
  {
    approved: "2.5.15",
    dependency: "@biomejs/biome",
    minimumDeclarations: 1,
  },
  {
    approved: "24.19.1",
    dependency: "@types/node",
    minimumDeclarations: 1,
  },
  { approved: "7.12.4", dependency: "ultracite", minimumDeclarations: 1 },
  { approved: "2.11.7", dependency: "turbo", minimumDeclarations: 1 },
  {
    approved: "2.11.7",
    dependency: "@turbo/gen",
    minimumDeclarations: 1,
  },
  {
    approved: "9.8.1",
    dependency: "@react-three/fiber",
    minimumDeclarations: 1,
  },
  { approved: "0.22.2", dependency: "afdocs", minimumDeclarations: 1 },
];

export const REGISTRY_REVIEWS = [
  [
    "react@latest",
    "19.3.0",
    "The declared React is 19.3.0, the latest 19.3 release. Fiber 9.8.1 accepts React 19.3 (its peer range is >=19 <19.4), and scene labels no longer use drei's Html, so no second React root is created per label.",
  ],
  [
    "react-dom@latest",
    "19.3.0",
    "React DOM is 19.3.0, the same release as React. react-dom 19.3.0 requires react ^19.3.0, and the overrides pin both to 19.3.0.",
  ],
  [
    "@types/react@latest",
    "19.3.0",
    "The React declarations match the React runtime at 19.3.0.",
  ],
  [
    "@types/react-dom@latest",
    "19.3.0",
    "The React DOM declarations match the React DOM runtime at 19.3.0.",
  ],
  [
    "mermaid@latest",
    "12.1.0",
    "Mermaid 12 requires Safari 17.4 while Nakafa supports the Next.js Safari 16.4 browser floor.",
  ],
  [
    "effect@latest",
    EFFECT_COHORT_VERSION,
    "Signed content contracts move with the exact Effect cohort: @nakafa/aksara-contracts peers on one exact Effect version.",
  ],
  [
    "@effect/platform-browser@latest",
    EFFECT_COHORT_VERSION,
    "The platform package must match the Effect cohort.",
  ],
  [
    "@effect/platform-node@latest",
    EFFECT_COHORT_VERSION,
    "The platform package must match the Effect cohort.",
  ],
  [
    "@effect/platform-node-shared@latest",
    EFFECT_COHORT_VERSION,
    "The transitive platform package must match the Effect cohort.",
  ],
  [
    "@effect/vitest@latest",
    EFFECT_COHORT_VERSION,
    "The test adapter must match the Effect cohort.",
  ],
  [
    "@effect/ai-openai-compat@latest",
    EFFECT_COHORT_VERSION,
    "The Confect server's transitive AI provider must match the Effect cohort.",
  ],
  [
    "@effect/ai-openrouter@latest",
    EFFECT_COHORT_VERSION,
    "The Confect server's transitive AI provider must match the Effect cohort.",
  ],
  [
    "@effect/tsgo@latest",
    "0.51.1",
    "Compiler patching moves with TypeScript and Effect; 0.49 migrates the compiler integrations to the current TypeScript path APIs, 0.50 adds the apiStabilityLeak diagnostic off by default (the maintainers preset only), and 0.51 adds declaration locations to it.",
  ],
  ["vitest@latest", "5.0.3", "The Effect 4 test adapter requires Vitest 5."],
  [
    "@vitest/coverage-istanbul@latest",
    "5.0.3",
    "Coverage must match the supported Vitest runner.",
  ],
  [
    "@vitest/ui@latest",
    "5.0.3",
    "The test UI must match the supported Vitest runner.",
  ],
  [
    "@nakafa/aksara-contracts@latest",
    CONTRACT_PACKAGE_VERSION,
    "Signed content contracts move with the exact Effect peer cohort.",
  ],
  ["typescript@latest", "7.0.2", "The native compiler is pinned exactly."],
  [
    "next@latest",
    "16.4.0",
    "Next.js 16.4 recommends Cache Components with partial prefetching for every app, which Nakafa already runs, adds `ensureStatic` and the `navigation()` and `prefetch()` deferral APIs, and ships one shared Turbopack runtime chunk with export mangling. It follows the 16.3.8 security release.",
  ],
  [
    "convex@latest",
    "1.46.0",
    "Additive validator `.optional()` and `FunctionReference_future`; acceptance uses an isolated deployment.",
  ],
  [
    "ai@latest",
    AI_SDK_COHORT.ai,
    "AI SDK packages move as one reviewed cohort.",
  ],
  [
    "@convex-dev/ai-sdk-provider@latest",
    AI_SDK_COHORT["@convex-dev/ai-sdk-provider"],
    "The Convex AI gateway provider moves with the AI SDK cohort; each bump rechecks the gateway module (confect/gateway).",
  ],
  [
    "better-auth@latest",
    "1.7.7",
    "@convex-dev/better-auth@0.12.5 declares the peer range >=1.6.11 <1.7.0, so runtime stays on the latest 1.6 patch (1.6.33) until the adapter opens 1.7. Its optional Vitest peer stops at 4, but only unused test-utils import Vitest; Nakafa auth runtime tests pass on 5.",
  ],
  [
    "@convex-dev/better-auth@latest",
    "0.12.5",
    "The adapter defines the accepted Better Auth peer range.",
  ],
  ["@biomejs/biome@latest", "2.5.15", "Formatting is reviewed with Ultracite."],
  ["ultracite@latest", "7.12.4", "Formatting is reviewed with Biome."],
  ["@types/node@24", "24.19.1", "Declarations remain on the Node 24 line."],
  ["node@24", "24.21.0", "The repository supports the Node 24 runtime line."],
  [
    "pnpm@latest",
    "12.10.1",
    "pnpm 12 records its own packages in a second YAML document at the top of the lockfile. OSV Scanner 2.6.0 reads both documents and Turborepo hashes each workspace as before, but GitHub's dependency graph reads only the first (dependabot/dependabot-core#15904), so it would report no application dependencies and close Aksara's Dependabot alerts. The one setting that keeps a single document, `pmOnFail: ignore`, also stops pnpm from enforcing the pinned version. pnpm 12 moves in both repositories once GitHub reads both documents.",
  ],
  [
    "react-doctor@latest",
    "0.9.17",
    "The local and CI scanners move as one reviewed cohort. The doctor script installs only releases older than a day, so it takes a release once that release has settled.",
  ],
  [
    "turbo@latest",
    "2.11.7",
    "Turbo and its generator move together; 2.11 adds hash and scope-filtering performance work, and 2.11.4 respects negated global dependencies in affected detection, with no config change for this repository.",
  ],
  [
    "@react-three/fiber@latest",
    "9.8.1",
    "Fiber 9.8.1 accepts React 19.3 (its peer range is >=19 <19.4) and mounts a scene inside the React DOM commit that renders its canvas. Scene labels draw in one DOM overlay per canvas (components/three/overlay.tsx) and no longer use drei's Html, which created a second React root per label. That root's replacement during Fiber's mount cleared the first label of every scene and made a label's removal throw on lesson navigation (pmndrs/drei#2867). drei 10.7.9 peers Fiber ^9.0.0, which 9.8.1 satisfies. Fiber 10, still prerelease, removes THREE.Clock: its upgrade drops the Clock allowance in apps/www/e2e/scene/lines.browser.ts and rechecks SceneTime in packages/design-system/components/three/canvas.tsx, which relies on Fiber 9 restarting the clock on frameloop changes and on internal.frames.",
  ],
  [
    "afdocs@latest",
    "0.22.2",
    "AFDocs 0.21 adds the page-size-transfer check. A cached surah page serves 0.73 to 0.88 MB; its first render after a deploy or a publication also carries the stream Next.js embeds for Partial Prefetching and serves up to 1.24 MB, so agent-docs.config.yml sets the pass line at 1.5 MB. AFDocs 0.22 adds the markdown-link-portability check, which the agent Markdown passes because site paths are written as absolute URLs. That check sends its first requests right after three checks that only compute, and for 50 large pages they hold the event loop longer than the 5 seconds a Node server keeps an idle connection, so the checker reused connections that the local server had closed (fetch failed, ECONNRESET). The start script of apps/www therefore keeps idle connections for 70 seconds, as a production proxy does.",
  ],
];

export const SCRIPT_DEPENDENCY_HOLDS = [
  {
    // dlx honors the workspace's zero minimumReleaseAge, so React Doctor's
    // throwaway install took versions npm was still propagating: a 4-minute-old
    // electron-to-chromium tarball returned 404 and failed Doctor. The pnpm 11
    // default of one day keeps that install on settled releases.
    approved: "pnpm --config.minimum-release-age=1440 dlx react-doctor@0.9.17",
    manifestPath: "apps/www/package.json",
    script: "doctor",
  },
];

export const FORBIDDEN_EFFECT_DEPENDENCIES = [
  "@effect/cluster",
  "@effect/experimental",
  "@effect/language-service",
  "@effect/platform",
  "@effect/rpc",
  "@effect/sql",
  "@effect/workflow",
];
