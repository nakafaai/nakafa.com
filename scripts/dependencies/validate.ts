import {
  DEPENDENCY_HOLDS,
  DEPENDENCY_RELEASE_AGE_EXCLUSIONS,
  DEPENDENCY_RELEASE_AGE_MINUTES,
  FORBIDDEN_EFFECT_DEPENDENCIES,
  SCRIPT_DEPENDENCY_HOLDS,
} from "#scripts/dependencies/policy";
import type {
  FirstPartyManifest,
  PackageManifest,
  WorkspaceManifest,
} from "#scripts/dependencies/source";

interface DependencyPolicyInput {
  readonly manifests: readonly FirstPartyManifest[];
  readonly rootManifest: PackageManifest;
  readonly workspace: WorkspaceManifest;
}

const DEPENDENCY_GROUPS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

/** Returns every first-party declaration for one dependency. */
export function dependencyDeclarations(
  manifests: readonly FirstPartyManifest[],
  dependency: string
) {
  const declarations: Array<{
    group: (typeof DEPENDENCY_GROUPS)[number];
    manifestPath: string;
    spec: string;
  }> = [];

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
}: DependencyPolicyInput) {
  const problems: string[] = [];

  for (const hold of DEPENDENCY_HOLDS) {
    const declarations = dependencyDeclarations(manifests, hold.dependency);
    if (declarations.length < hold.minimumDeclarations) {
      problems.push(
        `${hold.dependency} has ${declarations.length} declarations; expected at least ${hold.minimumDeclarations}.`
      );
    }

    const allowed = new Set(
      hold.allowed ?? (hold.approved ? [hold.approved] : [])
    );
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
