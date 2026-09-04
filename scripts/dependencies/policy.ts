interface DependencyHold {
  readonly allowed?: readonly string[];
  readonly approved?: string;
  readonly declarationPaths?: readonly string[];
  readonly dependency: string;
  readonly minimumDeclarations?: number;
}

export const CONTRACT_VERSION = "0.33.0";
export const PREDECESSOR_CONTRACT_SPECIFIER =
  "https://github.com/nakafaai/aksara/releases/download/contracts-v0.26.0/nakafa-aksara-contracts-0.26.0.tgz";

export const DEPENDENCY_HOLDS: readonly DependencyHold[] = [
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
  {
    approved: "0.36.5",
    dependency: "@effect/tsgo",
    minimumDeclarations: 1,
  },
  {
    approved: "npm:typescript@7.0.2",
    dependency: "@typescript/native",
    minimumDeclarations: 1,
  },
  {
    allowed: ["7.0.2", "catalog:", "npm:typescript@7.0.2"],
    dependency: "typescript",
    minimumDeclarations: 1,
  },
  { approved: "16.3.2", dependency: "next", minimumDeclarations: 1 },
  {
    approved: "16.3.2",
    dependency: "@next/bundle-analyzer",
    minimumDeclarations: 1,
  },
  { approved: "16.3.2", dependency: "@next/mdx", minimumDeclarations: 1 },
  {
    approved: "16.3.2",
    dependency: "@next/third-parties",
    minimumDeclarations: 1,
  },
  { approved: "1.45.0", dependency: "convex", minimumDeclarations: 1 },
  { approved: "7.0.77", dependency: "ai", minimumDeclarations: 1 },
  {
    approved: "4.0.80",
    dependency: "@ai-sdk/react",
    minimumDeclarations: 1,
  },
  {
    approved: "4.0.50",
    dependency: "@ai-sdk/google",
    minimumDeclarations: 1,
  },
  {
    approved: "4.0.62",
    dependency: "@ai-sdk/gateway",
    minimumDeclarations: 1,
  },
  {
    approved: "1.0.12",
    dependency: "@ai-sdk/devtools",
    minimumDeclarations: 1,
  },
  {
    approved: "1.6.30",
    dependency: "better-auth",
    minimumDeclarations: 1,
  },
  { approved: "1.6.30", dependency: "auth", minimumDeclarations: 1 },
  {
    approved: "0.12.5",
    dependency: "@convex-dev/better-auth",
    minimumDeclarations: 1,
  },
  {
    approved: CONTRACT_VERSION,
    declarationPaths: [
      "apps/www/package.json",
      "packages/ai/package.json",
      "packages/backend/package.json",
      "packages/contents/package.json",
      "packages/email/package.json",
      "packages/internationalization/package.json",
    ],
    dependency: "@nakafa/aksara-contracts",
  },
  {
    approved: PREDECESSOR_CONTRACT_SPECIFIER,
    declarationPaths: ["packages/backend/package.json"],
    dependency: "@nakafa/aksara-predecessor",
  },
  {
    approved: "2.5.10",
    dependency: "@biomejs/biome",
    minimumDeclarations: 1,
  },
  {
    approved: "24.13.3",
    dependency: "@types/node",
    minimumDeclarations: 1,
  },
  { approved: "7.10.6", dependency: "ultracite", minimumDeclarations: 1 },
  { approved: "2.10.11", dependency: "turbo", minimumDeclarations: 1 },
  {
    approved: "2.10.11",
    dependency: "@turbo/gen",
    minimumDeclarations: 1,
  },
];

export const REGISTRY_REVIEWS = [
  ["effect@rc", "4.0.0-rc.111", "Effect is intentionally pinned to RC 110."],
  [
    "@effect/platform-node@rc",
    "4.0.0-rc.111",
    "The platform package must match the Effect cohort.",
  ],
  [
    "@effect/platform-node-shared@rc",
    "4.0.0-rc.111",
    "The transitive platform package must match the Effect cohort.",
  ],
  [
    "@effect/vitest@rc",
    "4.0.0-rc.111",
    "The test adapter must match the Effect cohort.",
  ],
  ["@effect/tsgo@latest", "0.36.5", "Compiler patching moves with TypeScript."],
  ["typescript@latest", "7.0.2", "The native compiler is pinned exactly."],
  [
    "@typescript/typescript6@latest",
    "6.0.2",
    "Programmatic consumers still require the TypeScript 6 API.",
  ],
  [
    "next@latest",
    "16.3.2",
    "Stable 16.3.2 contains the reviewed catch-all cache-key backport.",
  ],
  ["convex@latest", "1.45.0", "Convex acceptance uses an isolated deployment."],
  ["ai@latest", "7.0.77", "AI SDK packages move as one reviewed cohort."],
  [
    "@ai-sdk/react@latest",
    "4.0.80",
    "AI SDK packages move as one reviewed cohort.",
  ],
  [
    "@ai-sdk/google@latest",
    "4.0.50",
    "AI SDK packages move as one reviewed cohort.",
  ],
  [
    "@ai-sdk/gateway@latest",
    "4.0.62",
    "AI SDK packages move as one reviewed cohort.",
  ],
  [
    "@ai-sdk/devtools@latest",
    "1.0.12",
    "AI SDK packages move as one reviewed cohort.",
  ],
  [
    "better-auth@latest",
    "1.7.1",
    "Better Auth remains on 1.6.30 because the Convex adapter rejects 1.7.",
  ],
  [
    "@convex-dev/better-auth@latest",
    "0.12.5",
    "The adapter defines the accepted Better Auth peer range.",
  ],
  ["@biomejs/biome@latest", "2.5.10", "Formatting is reviewed with Ultracite."],
  ["ultracite@latest", "7.10.6", "Formatting is reviewed with Biome."],
  ["@types/node@24", "24.13.3", "Declarations remain on the Node 24 line."],
  ["node@24", "24.19.0", "The repository supports the Node 24 runtime line."],
  ["pnpm@latest", "11.23.0", "pnpm owns workspace and lockfile semantics."],
  [
    "react-doctor@latest",
    "0.9.12",
    "The local and CI scanners move as one reviewed cohort.",
  ],
  ["turbo@latest", "2.10.11", "Turbo and its generator move together."],
];

export const SCRIPT_DEPENDENCY_HOLDS = [
  {
    approved: "pnpm dlx react-doctor@0.9.12",
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
