import { Array as Arr, Record as Rec, Result } from "effect";
import {
  AI_SDK_COHORT,
  DEPENDENCY_HOLDS,
  EFFECT_COHORT_OVERRIDES,
  EFFECT_COHORT_VERSION,
  FORBIDDEN_EFFECT_DEPENDENCIES,
  SCRIPT_DEPENDENCY_HOLDS,
  VITEST_COHORT_VERSION,
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

/** Enforces the approved versions and exact workspace ownership of each hold. */
function declarationProblems(manifests: readonly FirstPartyManifest[]) {
  const problems: string[] = [];
  for (const hold of DEPENDENCY_HOLDS) {
    const declarations = dependencyDeclarations(manifests, hold.dependency);
    if ("declarationPaths" in hold) {
      const actualPaths = declarations
        .map(({ manifestPath }) => manifestPath)
        .sort();
      const expectedPaths = [...hold.declarationPaths].sort();
      if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
        problems.push(
          `${hold.dependency} declarations are ${actualPaths.join(", ") || "missing"}; expected ${expectedPaths.join(", ")}.`
        );
      }
    } else if (declarations.length < hold.minimumDeclarations) {
      problems.push(
        `${hold.dependency} has ${declarations.length} declarations; expected at least ${hold.minimumDeclarations}.`
      );
    }

    const allowed = new Set("allowed" in hold ? hold.allowed : [hold.approved]);
    for (const declaration of declarations) {
      if (!allowed.has(declaration.spec)) {
        problems.push(
          `${declaration.manifestPath} declares ${hold.dependency} as ${declaration.spec}; approved ${[...allowed].join(" or ")}.`
        );
      }
    }
  }
  return problems;
}

/** Enforces the Effect, TypeScript, Vitest, and AI SDK cohorts the workspace pins. */
function cohortProblems(workspace: WorkspaceManifest) {
  const problems: string[] = [];
  if (workspace.catalog?.effect !== EFFECT_COHORT_VERSION) {
    problems.push(
      `The Effect catalog must be exactly ${EFFECT_COHORT_VERSION}.`
    );
  }
  if (workspace.catalog?.["@effect/platform-node"] !== EFFECT_COHORT_VERSION) {
    problems.push(
      `The platform-node catalog must match Effect ${EFFECT_COHORT_VERSION}.`
    );
  }
  if (workspace.catalog?.["@effect/vitest"] !== EFFECT_COHORT_VERSION) {
    problems.push(
      `The Effect Vitest catalog must match Effect ${EFFECT_COHORT_VERSION}.`
    );
  }
  // Effect packages that only dependencies declare stay in the cohort.
  for (const dependency of EFFECT_COHORT_OVERRIDES) {
    if (workspace.overrides?.[dependency] !== EFFECT_COHORT_VERSION) {
      problems.push(
        `The ${dependency} override must match Effect ${EFFECT_COHORT_VERSION}.`
      );
    }
  }
  if (workspace.catalog?.typescript !== "7.0.2") {
    problems.push("The native TypeScript catalog must be exactly 7.0.2.");
  }
  for (const dependency of [
    "vitest",
    "@vitest/coverage-istanbul",
    "@vitest/ui",
  ]) {
    if (workspace.catalog?.[dependency] !== VITEST_COHORT_VERSION) {
      problems.push(
        `${dependency} must match the supported Vitest ${VITEST_COHORT_VERSION} cohort.`
      );
    }
  }
  return Arr.appendAll(
    problems,
    Arr.filterMap(Rec.toEntries(AI_SDK_COHORT), ([dependency, version]) =>
      workspace.catalog?.[dependency] === version
        ? Result.failVoid
        : Result.succeed(
            `The ${dependency} catalog must be exactly ${version}.`
          )
    )
  );
}

/** Validates exact cohort declarations and the absence of v3 packages. */
export function validateDependencyPolicy({
  manifests,
  rootManifest,
  workspace,
}: DependencyPolicyInput) {
  const problems = declarationProblems(manifests);

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

  problems.push(...cohortProblems(workspace));
  if (rootManifest.packageManager !== "pnpm@11.28.2") {
    problems.push("packageManager must be pnpm@11.27.0.");
  }
  if (rootManifest.devEngines?.runtime?.version !== "24.21.0") {
    problems.push("The managed Node runtime must be 24.21.0.");
  }
  return problems;
}
