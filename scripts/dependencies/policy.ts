/** The exact specs one reviewed dependency may declare. */
type ApprovedSpecs =
  | { readonly allowed: readonly [string, ...string[]] }
  | { readonly approved: string };

/** The manifests that must declare one reviewed dependency. */
type DeclarationOwners =
  | { readonly declarationPaths: readonly string[] }
  | { readonly minimumDeclarations: number };

type DependencyHold = ApprovedSpecs &
  DeclarationOwners & { readonly dependency: string };

export const CONTRACT_PACKAGE_VERSION = "0.42.0";
/** The Vitest runner, coverage, and UI packages move as one catalog cohort. */
export const VITEST_COHORT_VERSION = "5.0.2";

export const DEPENDENCY_HOLDS: readonly DependencyHold[] = [
  { approved: "19.2.8", dependency: "react", minimumDeclarations: 1 },
  { approved: "19.2.8", dependency: "react-dom", minimumDeclarations: 1 },
  { approved: "19.2.18", dependency: "@types/react", minimumDeclarations: 1 },
  {
    approved: "19.2.7",
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
    approved: "0.46.1",
    dependency: "@effect/tsgo",
    minimumDeclarations: 1,
  },
  {
    allowed: ["7.0.2", "catalog:", "npm:typescript@7.0.2"],
    dependency: "typescript",
    minimumDeclarations: 1,
  },
  { approved: "16.3.7", dependency: "next", minimumDeclarations: 1 },
  {
    approved: "16.3.7",
    dependency: "@next/third-parties",
    minimumDeclarations: 1,
  },
  { approved: "1.46.0", dependency: "convex", minimumDeclarations: 1 },
  { approved: "7.0.123", dependency: "ai", minimumDeclarations: 1 },
  {
    approved: "4.0.86",
    dependency: "@ai-sdk/google",
    minimumDeclarations: 1,
  },
  {
    approved: "4.0.101",
    dependency: "@ai-sdk/gateway",
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
    ],
    dependency: "@nakafa/aksara-contracts",
  },
  {
    approved: "2.5.14",
    dependency: "@biomejs/biome",
    minimumDeclarations: 1,
  },
  {
    approved: "24.19.0",
    dependency: "@types/node",
    minimumDeclarations: 1,
  },
  { approved: "7.12.2", dependency: "ultracite", minimumDeclarations: 1 },
  { approved: "2.11.5", dependency: "turbo", minimumDeclarations: 1 },
  {
    approved: "2.11.5",
    dependency: "@turbo/gen",
    minimumDeclarations: 1,
  },
  {
    approved: "^0.49.0",
    dependency: "@polar-sh/sdk",
    minimumDeclarations: 1,
  },
  {
    approved: "9.7.0",
    dependency: "@react-three/fiber",
    minimumDeclarations: 1,
  },
  { approved: "0.20.0", dependency: "afdocs", minimumDeclarations: 1 },
];

export const REGISTRY_REVIEWS = [
  [
    "react@latest",
    "19.3.0",
    "Fiber 9.7.0 requires React below 19.3 and bundles the 19.2 reconciler.",
  ],
  [
    "react-dom@latest",
    "19.3.0",
    "React DOM stays on the same supported 19.2.8 runtime.",
  ],
  [
    "@types/react@latest",
    "19.3.0",
    "React declarations stay on the supported 19.2 runtime line.",
  ],
  [
    "@types/react-dom@latest",
    "19.3.0",
    "React DOM declarations stay on the supported 19.2 runtime line.",
  ],
  [
    "mermaid@latest",
    "12.0.0",
    "Mermaid 12 requires Safari 17.4 while Nakafa supports the Next.js Safari 16.4 browser floor.",
  ],
  [
    "effect@rc",
    "4.0.0-rc.118",
    "Signed content contracts require the exact RC117 cohort: @nakafa/aksara-contracts 0.42.0 peers on RC117 exactly.",
  ],
  [
    "@effect/platform-node@rc",
    "4.0.0-rc.118",
    "The platform package must match the Effect cohort.",
  ],
  [
    "@effect/platform-node-shared@rc",
    "4.0.0-rc.118",
    "The transitive platform package must match the Effect cohort.",
  ],
  [
    "@effect/vitest@rc",
    "4.0.0-rc.118",
    "The test adapter must match the Effect cohort.",
  ],
  [
    "@effect/tsgo@latest",
    "0.47.0",
    "Compiler patching moves with TypeScript and Effect; 0.46.1 fixes diagnostics within the Effect RC117 cohort, and 0.47.0 targets the Effect RC118 cohort.",
  ],
  ["vitest@latest", "5.0.2", "The Effect RC117 adapter accepts Vitest 5."],
  [
    "@vitest/coverage-istanbul@latest",
    "5.0.2",
    "Coverage must match the supported Vitest 5.0.2 runner.",
  ],
  [
    "@vitest/ui@latest",
    "5.0.2",
    "The test UI must match the supported Vitest 5.0.2 runner.",
  ],
  [
    "@nakafa/aksara-contracts@latest",
    CONTRACT_PACKAGE_VERSION,
    "Signed content contracts move with the exact Effect peer cohort.",
  ],
  ["typescript@latest", "7.0.2", "The native compiler is pinned exactly."],
  [
    "next@latest",
    "16.3.7",
    "Stable 16.3.7 backports a Turbopack consistent-read fix onto 16.3.6, which fixed GHSA-vcvr-r3jv-pc5j in Node.js next/og ImageResponse.",
  ],
  [
    "convex@latest",
    "1.46.0",
    "Additive validator `.optional()` and `FunctionReference_future`; acceptance uses an isolated deployment.",
  ],
  ["ai@latest", "7.0.123", "AI SDK packages move as one reviewed cohort."],
  [
    "@ai-sdk/google@latest",
    "4.0.86",
    "AI SDK packages move as one reviewed cohort.",
  ],
  [
    "@ai-sdk/gateway@latest",
    "4.0.101",
    "AI SDK packages move as one reviewed cohort.",
  ],
  [
    "better-auth@latest",
    "1.7.6",
    "@convex-dev/better-auth@0.12.5 declares the peer range >=1.6.11 <1.7.0, so runtime stays on the latest 1.6 patch (1.6.33) until the adapter opens 1.7. Its optional Vitest peer stops at 4, but only unused test-utils import Vitest; Nakafa auth runtime tests pass on 5.",
  ],
  [
    "@convex-dev/better-auth@latest",
    "0.12.5",
    "The adapter defines the accepted Better Auth peer range.",
  ],
  ["@biomejs/biome@latest", "2.5.14", "Formatting is reviewed with Ultracite."],
  ["ultracite@latest", "7.12.2", "Formatting is reviewed with Biome."],
  ["@types/node@24", "24.19.0", "Declarations remain on the Node 24 line."],
  ["node@24", "24.21.0", "The repository supports the Node 24 runtime line."],
  [
    "pnpm@latest",
    "12.8.1",
    "OSV Scanner 2.5.1 skips the application graph after pnpm 12 adds a package-manager YAML document, and the 2.6.0 release notes do not address it.",
  ],
  [
    "react-doctor@latest",
    "0.9.14",
    "The local and CI scanners move as one reviewed cohort.",
  ],
  [
    "turbo@latest",
    "2.11.5",
    "Turbo and its generator move together; 2.11 adds hash and scope-filtering performance work, and 2.11.4 respects negated global dependencies in affected detection, with no config change for this repository.",
  ],
  [
    "@react-three/fiber@latest",
    "9.8.1",
    "Fiber 9.8 widens React support to 19.3 and moves to the React 19.3 scheduler, so it moves with the React 19.3 upgrade; with React 19.2 it broke DOM removal during lesson navigation. Fiber 10, still prerelease, removes THREE.Clock: its upgrade drops the Clock allowance in apps/www/e2e/scene.browser.ts and rechecks SceneTime in packages/design-system/components/three/canvas.tsx, which relies on Fiber 9 restarting the clock on frameloop changes and on internal.frames.",
  ],
  [
    "@polar-sh/sdk@latest",
    "1.0.0",
    "SDK 1.0 replaces the standalone funcs and model subpaths with versioned API service modules; the billing integration migrates in its own change.",
  ],
  [
    "afdocs@latest",
    "0.22.2",
    "AFDocs 0.21 adds the page-size-transfer check, and Quran surah pages serve 1.1 to 1.7 MB of hydration payload for about 40 KB of text; the site contract moves after the surah payload shrinks.",
  ],
];

export const SCRIPT_DEPENDENCY_HOLDS = [
  {
    approved: "pnpm dlx react-doctor@0.9.14",
    manifestPath: "apps/www/package.json",
    script: "doctor",
  },
];

export const FORBIDDEN_EFFECT_DEPENDENCIES = new Set([
  "@effect/cluster",
  "@effect/experimental",
  "@effect/language-service",
  "@effect/platform",
  "@effect/rpc",
  "@effect/sql",
  "@effect/workflow",
]);
