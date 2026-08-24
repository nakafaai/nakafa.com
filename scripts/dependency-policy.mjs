import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { parse } from "yaml";

export const CONTRACT_ARCHIVE =
  "https://github.com/nakafaai/aksara/releases/download/contracts-v0.15.0/nakafa-aksara-contracts-0.15.0.tgz";

export const DEPENDENCY_RELEASE_AGE_MINUTES = 1440;

export const DEPENDENCY_RELEASE_AGE_EXCLUSIONS = [
  "@ai-sdk/gateway@4.0.62",
  "@ai-sdk/google@4.0.50",
  "@ai-sdk/mcp@2.0.36",
  "@ai-sdk/react@4.0.80",
  "@biomejs/biome@2.5.10",
  "@biomejs/cli-darwin-arm64@2.5.10",
  "@biomejs/cli-darwin-x64@2.5.10",
  "@biomejs/cli-linux-arm64-musl@2.5.10",
  "@biomejs/cli-linux-arm64@2.5.10",
  "@biomejs/cli-linux-x64-musl@2.5.10",
  "@biomejs/cli-linux-x64@2.5.10",
  "@biomejs/cli-win32-arm64@2.5.10",
  "@biomejs/cli-win32-x64@2.5.10",
  "@mendable/firecrawl-js@4.35.0",
  "@next/bundle-analyzer@16.3.2",
  "@next/env@16.3.2",
  "@next/mdx@16.3.2",
  "@next/swc-darwin-arm64@16.3.2",
  "@next/swc-darwin-x64@16.3.2",
  "@next/swc-linux-arm64-gnu@16.3.2",
  "@next/swc-linux-arm64-musl@16.3.2",
  "@next/swc-linux-x64-gnu@16.3.2",
  "@next/swc-linux-x64-musl@16.3.2",
  "@next/swc-win32-arm64-msvc@16.3.2",
  "@next/swc-win32-x64-msvc@16.3.2",
  "@next/third-parties@16.3.2",
  "@takumi-rs/core-darwin-arm64@2.12.0",
  "@takumi-rs/core-darwin-x64@2.12.0",
  "@takumi-rs/core-linux-arm64-gnu@2.12.0",
  "@takumi-rs/core-linux-arm64-musl@2.12.0",
  "@takumi-rs/core-linux-x64-gnu@2.12.0",
  "@takumi-rs/core-linux-x64-musl@2.12.0",
  "@takumi-rs/core-win32-arm64-msvc@2.12.0",
  "@takumi-rs/core-win32-x64-msvc@2.12.0",
  "@takumi-rs/core@2.12.0",
  "@takumi-rs/helpers@2.12.0",
  "@takumi-rs/wasm@2.12.0",
  "@tanstack/query-core@5.102.2",
  "@tanstack/query-devtools@5.102.2",
  "@tanstack/react-query-devtools@5.102.2",
  "@tanstack/react-query@5.102.2",
  "@types/react-dom@19.2.5",
  "afdocs@0.20.0",
  "ai@7.0.77",
  "convex@1.45.0",
  "next@16.3.2",
  "pnpm@11.23.0",
  "takumi-js@2.12.0",
];

export const DEPENDENCY_HOLDS = [
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
    approved: CONTRACT_ARCHIVE,
    dependency: "@nakafa/aksara-contracts",
    minimumDeclarations: 6,
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

const DEPENDENCY_GROUPS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

/** Reads every first-party package manifest without entering vendored source. */
export function readFirstPartyManifests(root) {
  const manifests = [path.join(root, "package.json")];

  for (const workspaceDirectory of ["apps", "packages"]) {
    const workspaceRoot = path.join(root, workspaceDirectory);
    for (const entry of readdirSync(workspaceRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      manifests.push(path.join(workspaceRoot, entry.name, "package.json"));
    }
  }

  return manifests.map((manifestPath) => ({
    manifest: JSON.parse(readFileSync(manifestPath, "utf8")),
    path: path.relative(root, manifestPath),
  }));
}

/** Returns every first-party declaration for one dependency. */
export function dependencyDeclarations(manifests, dependency) {
  const declarations = [];

  for (const { manifest, path: manifestPath } of manifests) {
    for (const group of DEPENDENCY_GROUPS) {
      const spec = manifest[group]?.[dependency];
      if (typeof spec === "string") {
        declarations.push({ group, manifestPath, spec });
      }
    }
  }

  return declarations;
}

/** Validates exact cohort declarations and the absence of v3 packages. */
export function validateDependencyPolicy({
  manifests,
  rootManifest,
  workspace,
}) {
  const problems = [];

  for (const hold of DEPENDENCY_HOLDS) {
    const declarations = dependencyDeclarations(manifests, hold.dependency);
    if (declarations.length < hold.minimumDeclarations) {
      problems.push(
        `${hold.dependency} has ${declarations.length} declarations; expected at least ${hold.minimumDeclarations}.`
      );
    }

    const allowed = new Set(hold.allowed ?? [hold.approved]);
    for (const declaration of declarations) {
      if (!allowed.has(declaration.spec)) {
        problems.push(
          `${declaration.manifestPath} declares ${hold.dependency} as ${declaration.spec}; approved ${[...allowed].join(" or ")}.`
        );
      }
    }
  }

  for (const dependency of FORBIDDEN_EFFECT_DEPENDENCIES) {
    for (const declaration of dependencyDeclarations(manifests, dependency)) {
      problems.push(
        `${declaration.manifestPath} retains obsolete Effect dependency ${dependency}.`
      );
    }
  }

  for (const hold of SCRIPT_DEPENDENCY_HOLDS) {
    const manifest = manifests.find(
      ({ path: manifestPath }) => manifestPath === hold.manifestPath
    )?.manifest;
    const actual = manifest?.scripts?.[hold.script];
    if (actual !== hold.approved) {
      problems.push(
        `${hold.manifestPath} script ${hold.script} is ${String(actual ?? "missing")}; approved ${hold.approved}.`
      );
    }
  }

  const expectedIgnores = [
    ...new Set([
      ...DEPENDENCY_HOLDS.map(({ dependency }) => dependency),
      "node",
      "pnpm",
    ]),
  ].sort();
  const actualIgnores = [...(workspace.update?.ignoreDeps ?? [])].sort();
  if (JSON.stringify(actualIgnores) !== JSON.stringify(expectedIgnores)) {
    problems.push(
      "pnpm update.ignoreDeps does not match the reviewed hold policy."
    );
  }

  if (workspace.catalog?.effect !== "4.0.0-rc.110") {
    problems.push("The Effect catalog must be exactly 4.0.0-rc.110.");
  }
  if (workspace.catalog?.["@effect/platform-node"] !== "4.0.0-rc.110") {
    problems.push("The platform-node catalog must match Effect RC 110.");
  }
  if (workspace.catalog?.["@effect/vitest"] !== "4.0.0-rc.110") {
    problems.push("The Effect Vitest catalog must match Effect RC 110.");
  }
  if (
    workspace.overrides?.["@effect/platform-node-shared"] !== "4.0.0-rc.110"
  ) {
    problems.push(
      "The platform-node-shared override must match Effect RC 110."
    );
  }
  if (workspace.catalog?.typescript !== "npm:@typescript/typescript6@6.0.2") {
    problems.push(
      "The TypeScript JavaScript API compatibility alias must be 6.0.2."
    );
  }
  if (rootManifest.packageManager !== "pnpm@11.23.0") {
    problems.push("packageManager must be pnpm@11.23.0.");
  }
  if (rootManifest.devEngines?.runtime?.version !== "24.19.0") {
    problems.push("The managed Node runtime must be 24.19.0.");
  }
  if (workspace.minimumReleaseAge !== DEPENDENCY_RELEASE_AGE_MINUTES) {
    problems.push("Dependency releases must mature for exactly 1440 minutes.");
  }
  if (workspace.minimumReleaseAgeStrict !== true) {
    problems.push("Dependency release-age enforcement must remain strict.");
  }
  const expectedExclusions = [...DEPENDENCY_RELEASE_AGE_EXCLUSIONS].sort();
  const actualExclusions = [
    ...(workspace.minimumReleaseAgeExclude ?? []),
  ].sort();
  if (JSON.stringify(actualExclusions) !== JSON.stringify(expectedExclusions)) {
    problems.push(
      "pnpm minimumReleaseAgeExclude does not match the reviewed exception policy."
    );
  }

  return problems;
}

/** Reads and validates the repository dependency policy. */
export function inspectDependencyPolicy(root) {
  const rootManifest = JSON.parse(
    readFileSync(path.join(root, "package.json"), "utf8")
  );
  const workspace = parse(
    readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8")
  );
  const manifests = readFirstPartyManifests(root);
  return validateDependencyPolicy({ manifests, rootManifest, workspace });
}
