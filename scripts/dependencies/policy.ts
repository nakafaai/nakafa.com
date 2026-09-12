interface DependencyHold {
  readonly allowed?: readonly string[];
  readonly approved?: string;
  readonly declarationPaths?: readonly string[];
  readonly dependency: string;
  readonly minimumDeclarations?: number;
}

export const CONTRACT_VERSION = "0.38.0";

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
  { approved: "catalog:", dependency: "vitest", minimumDeclarations: 1 },
  {
    approved: "catalog:",
    dependency: "@vitest/coverage-istanbul",
    minimumDeclarations: 1,
  },
  { approved: "catalog:", dependency: "@vitest/ui", minimumDeclarations: 1 },
  {
    approved: "0.41.0",
    dependency: "@effect/tsgo",
    minimumDeclarations: 1,
  },
  {
    allowed: ["7.0.2", "catalog:", "npm:typescript@7.0.2"],
    dependency: "typescript",
    minimumDeclarations: 1,
  },
  { approved: "16.3.5", dependency: "next", minimumDeclarations: 1 },
  {
    approved: "16.3.5",
    dependency: "@next/third-parties",
    minimumDeclarations: 1,
  },
  { approved: "1.45.0", dependency: "convex", minimumDeclarations: 1 },
  { approved: "7.0.93", dependency: "ai", minimumDeclarations: 1 },
  {
    approved: "4.0.96",
    dependency: "@ai-sdk/react",
    minimumDeclarations: 1,
  },
  {
    approved: "4.0.64",
    dependency: "@ai-sdk/google",
    minimumDeclarations: 1,
  },
  {
    approved: "4.0.75",
    dependency: "@ai-sdk/gateway",
    minimumDeclarations: 1,
  },
  {
    approved: "1.0.15",
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
    approved: "2.5.12",
    dependency: "@biomejs/biome",
    minimumDeclarations: 1,
  },
  {
    approved: "24.13.3",
    dependency: "@types/node",
    minimumDeclarations: 1,
  },
  { approved: "7.11.0", dependency: "ultracite", minimumDeclarations: 1 },
  { approved: "2.10.12", dependency: "turbo", minimumDeclarations: 1 },
  {
    approved: "2.10.12",
    dependency: "@turbo/gen",
    minimumDeclarations: 1,
  },
];

export const REGISTRY_REVIEWS = [
  [
    "effect@rc",
    "4.0.0-rc.112",
    "Signed content contracts require the exact RC112 cohort.",
  ],
  [
    "@effect/platform-node@rc",
    "4.0.0-rc.112",
    "The platform package must match the Effect cohort.",
  ],
  [
    "@effect/platform-node-shared@rc",
    "4.0.0-rc.112",
    "The transitive platform package must match the Effect cohort.",
  ],
  [
    "@effect/vitest@rc",
    "4.0.0-rc.112",
    "The test adapter must match the Effect cohort.",
  ],
  ["@effect/tsgo@latest", "0.41.0", "Compiler patching moves with TypeScript."],
  [
    "vitest@latest",
    "5.0.0",
    "The Effect RC112 adapter requires Vitest below version 5.",
  ],
  [
    "@vitest/coverage-istanbul@latest",
    "5.0.0",
    "Coverage must match the supported Vitest 4.1.11 runner.",
  ],
  [
    "@vitest/ui@latest",
    "5.0.0",
    "The test UI must match the supported Vitest 4.1.11 runner.",
  ],
  [
    "@nakafa/aksara-contracts@latest",
    CONTRACT_VERSION,
    "Signed content contracts move with the exact Effect peer cohort.",
  ],
  ["typescript@latest", "7.0.2", "The native compiler is pinned exactly."],
  [
    "next@latest",
    "16.3.5",
    "Stable 16.3.5 backports image cache hardening, standalone NFTs with adapters, CSP nonces for loading and template, and the use-cache prerender signal fix.",
  ],
  ["convex@latest", "1.45.0", "Convex acceptance uses an isolated deployment."],
  ["ai@latest", "7.0.93", "AI SDK packages move as one reviewed cohort."],
  [
    "@ai-sdk/react@latest",
    "4.0.96",
    "AI SDK packages move as one reviewed cohort.",
  ],
  [
    "@ai-sdk/google@latest",
    "4.0.64",
    "AI SDK packages move as one reviewed cohort.",
  ],
  [
    "@ai-sdk/gateway@latest",
    "4.0.75",
    "AI SDK packages move as one reviewed cohort.",
  ],
  [
    "@ai-sdk/devtools@latest",
    "1.0.15",
    "AI SDK packages move as one reviewed cohort.",
  ],
  [
    "better-auth@latest",
    "1.7.3",
    "Better Auth remains on 1.6.30 because the Convex adapter rejects 1.7.",
  ],
  [
    "@convex-dev/better-auth@latest",
    "0.12.5",
    "The adapter defines the accepted Better Auth peer range.",
  ],
  ["@biomejs/biome@latest", "2.5.12", "Formatting is reviewed with Ultracite."],
  ["ultracite@latest", "7.11.0", "Formatting is reviewed with Biome."],
  ["@types/node@24", "24.13.3", "Declarations remain on the Node 24 line."],
  ["node@24", "24.20.0", "The repository supports the Node 24 runtime line."],
  [
    "pnpm@latest",
    "12.3.4",
    "OSV Scanner 2.5.1 skips the application graph after pnpm 12 adds a package-manager YAML document.",
  ],
  [
    "react-doctor@latest",
    "0.9.13",
    "The local and CI scanners move as one reviewed cohort.",
  ],
  ["turbo@latest", "2.10.12", "Turbo and its generator move together."],
];

export const SCRIPT_DEPENDENCY_HOLDS = [
  {
    approved: "pnpm dlx react-doctor@0.9.13",
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
