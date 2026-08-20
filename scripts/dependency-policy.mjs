import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { parse } from "yaml";

export const CONTRACT_ARCHIVE =
  "https://github.com/nakafaai/aksara/releases/download/contracts-v0.14.1/nakafa-aksara-contracts-0.14.1.tgz";

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
  { approved: "16.3.1", dependency: "next", minimumDeclarations: 1 },
  {
    approved: "16.3.1",
    dependency: "@next/bundle-analyzer",
    minimumDeclarations: 1,
  },
  { approved: "16.3.1", dependency: "@next/mdx", minimumDeclarations: 1 },
  {
    approved: "16.3.1",
    dependency: "@next/third-parties",
    minimumDeclarations: 1,
  },
  { approved: "1.44.0", dependency: "convex", minimumDeclarations: 1 },
  { approved: "7.0.70", dependency: "ai", minimumDeclarations: 1 },
  {
    approved: "4.0.73",
    dependency: "@ai-sdk/react",
    minimumDeclarations: 1,
  },
  {
    approved: "4.0.47",
    dependency: "@ai-sdk/google",
    minimumDeclarations: 1,
  },
  {
    approved: "4.0.56",
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
    approved: "2.5.9",
    dependency: "@biomejs/biome",
    minimumDeclarations: 1,
  },
  {
    approved: "24.13.3",
    dependency: "@types/node",
    minimumDeclarations: 1,
  },
  { approved: "7.10.5", dependency: "ultracite", minimumDeclarations: 1 },
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
  ["next@latest", "16.3.1", "The retained patch is rebased for this release."],
  ["convex@latest", "1.44.0", "Convex acceptance uses an isolated deployment."],
  ["ai@latest", "7.0.70", "AI SDK packages move as one reviewed cohort."],
  [
    "@ai-sdk/react@latest",
    "4.0.73",
    "AI SDK packages move as one reviewed cohort.",
  ],
  [
    "@ai-sdk/google@latest",
    "4.0.47",
    "AI SDK packages move as one reviewed cohort.",
  ],
  [
    "@ai-sdk/gateway@latest",
    "4.0.56",
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
  ["@biomejs/biome@latest", "2.5.9", "Formatting is reviewed with Ultracite."],
  [
    "ultracite@latest",
    "7.10.6",
    "The approved migration target remains 7.10.5 for this pull request.",
  ],
  ["@types/node@24", "24.13.3", "Declarations remain on the Node 24 line."],
  ["node@24", "24.19.0", "The repository supports the Node 24 runtime line."],
  ["pnpm@latest", "11.22.0", "pnpm owns workspace and lockfile semantics."],
  ["turbo@latest", "2.10.11", "Turbo and its generator move together."],
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
  if (workspace.catalog?.typescript !== "npm:@typescript/typescript6@6.0.2") {
    problems.push(
      "The TypeScript JavaScript API compatibility alias must be 6.0.2."
    );
  }
  if (rootManifest.packageManager !== "pnpm@11.22.0") {
    problems.push("packageManager must be pnpm@11.22.0.");
  }
  if (rootManifest.devEngines?.runtime?.version !== "24.19.0") {
    problems.push("The managed Node runtime must be 24.19.0.");
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
