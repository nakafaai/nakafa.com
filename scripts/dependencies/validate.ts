import { Array as Arr, Option, Order, Record as Rec } from "effect";
import {
  AI_SDK_COHORT,
  DEPENDENCY_HOLDS,
  EFFECT_COHORT_OVERRIDES,
  EFFECT_COHORT_VERSION,
  FORBIDDEN_EFFECT_DEPENDENCIES,
  PACKAGE_MANAGER,
  SCRIPT_DEPENDENCY_HOLDS,
  VITEST_COHORT_VERSION,
} from "#scripts/dependencies/policy";
import type {
  FirstPartyManifest,
  PackageManifest,
  WorkspaceManifest,
} from "#scripts/dependencies/source";
import { problemWhen } from "#scripts/problem";

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
  return Arr.flatMap(manifests, ({ manifest, path: manifestPath }) =>
    Arr.flatMap(DEPENDENCY_GROUPS, (group) => {
      const spec = manifest[group]?.[dependency];
      return typeof spec === "string" ? [{ group, manifestPath, spec }] : [];
    })
  );
}

/** Enforces the approved versions and exact workspace ownership of each hold. */
function declarationProblems(manifests: readonly FirstPartyManifest[]) {
  return Arr.flatMap(DEPENDENCY_HOLDS, (hold) => {
    const declarations = dependencyDeclarations(manifests, hold.dependency);
    const actualPaths = Arr.sort(
      Arr.map(declarations, ({ manifestPath }) => manifestPath),
      Order.String
    );
    const expectedPaths =
      "declarationPaths" in hold
        ? Arr.sort(hold.declarationPaths, Order.String)
        : [];
    const allowed = new Set("allowed" in hold ? hold.allowed : [hold.approved]);
    return Arr.flatten([
      "declarationPaths" in hold
        ? problemWhen(
            JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths),
            `${hold.dependency} declarations are ${Arr.join(actualPaths, ", ") || "missing"}; expected ${Arr.join(expectedPaths, ", ")}.`
          )
        : problemWhen(
            declarations.length < hold.minimumDeclarations,
            `${hold.dependency} has ${declarations.length} declarations; expected at least ${hold.minimumDeclarations}.`
          ),
      Arr.flatMap(declarations, (declaration) =>
        problemWhen(
          !allowed.has(declaration.spec),
          `${declaration.manifestPath} declares ${hold.dependency} as ${declaration.spec}; approved ${Arr.join([...allowed], " or ")}.`
        )
      ),
    ]);
  });
}

/** Enforces the Effect, TypeScript, Vitest, and AI SDK cohorts the workspace pins. */
function cohortProblems(workspace: WorkspaceManifest) {
  return Arr.flatten([
    problemWhen(
      workspace.catalog?.effect !== EFFECT_COHORT_VERSION,
      `The Effect catalog must be exactly ${EFFECT_COHORT_VERSION}.`
    ),
    problemWhen(
      workspace.catalog?.["@effect/platform-node"] !== EFFECT_COHORT_VERSION,
      `The platform-node catalog must match Effect ${EFFECT_COHORT_VERSION}.`
    ),
    problemWhen(
      workspace.catalog?.["@effect/vitest"] !== EFFECT_COHORT_VERSION,
      `The Effect Vitest catalog must match Effect ${EFFECT_COHORT_VERSION}.`
    ),
    // Effect packages that only dependencies declare stay in the cohort.
    Arr.flatMap(EFFECT_COHORT_OVERRIDES, (dependency) =>
      problemWhen(
        workspace.overrides?.[dependency] !== EFFECT_COHORT_VERSION,
        `The ${dependency} override must match Effect ${EFFECT_COHORT_VERSION}.`
      )
    ),
    problemWhen(
      workspace.catalog?.typescript !== "7.0.2",
      "The native TypeScript catalog must be exactly 7.0.2."
    ),
    Arr.flatMap(
      ["vitest", "@vitest/coverage-istanbul", "@vitest/ui"],
      (dependency) =>
        problemWhen(
          workspace.catalog?.[dependency] !== VITEST_COHORT_VERSION,
          `${dependency} must match the supported Vitest ${VITEST_COHORT_VERSION} cohort.`
        )
    ),
    Arr.flatMap(Rec.toEntries(AI_SDK_COHORT), ([dependency, version]) =>
      problemWhen(
        workspace.catalog?.[dependency] !== version,
        `The ${dependency} catalog must be exactly ${version}.`
      )
    ),
  ]);
}

/** Validates exact cohort declarations and the absence of v3 packages. */
export function validateDependencyPolicy({
  manifests,
  rootManifest,
  workspace,
}: DependencyPolicyInput) {
  const expectedIgnores = Arr.sort(
    new Set([
      ...Arr.map(DEPENDENCY_HOLDS, ({ dependency }) => dependency),
      "node",
      "pnpm",
    ]),
    Order.String
  );
  const actualIgnores = Arr.sort(
    workspace.update?.ignoreDeps ?? [],
    Order.String
  );
  return Arr.flatten([
    declarationProblems(manifests),
    Arr.flatMap(Arr.fromIterable(FORBIDDEN_EFFECT_DEPENDENCIES), (dependency) =>
      Arr.map(
        dependencyDeclarations(manifests, dependency),
        (declaration) =>
          `${declaration.manifestPath} retains obsolete Effect dependency ${dependency}.`
      )
    ),
    Arr.flatMap(SCRIPT_DEPENDENCY_HOLDS, (hold) => {
      const manifest = Option.getOrUndefined(
        Arr.findFirst(
          manifests,
          ({ path: manifestPath }) => manifestPath === hold.manifestPath
        )
      )?.manifest;
      const actual = manifest?.scripts?.[hold.script];
      return problemWhen(
        actual !== hold.approved,
        `${hold.manifestPath} script ${hold.script} is ${String(actual ?? "missing")}; approved ${hold.approved}.`
      );
    }),
    problemWhen(
      JSON.stringify(actualIgnores) !== JSON.stringify(expectedIgnores),
      "pnpm update.ignoreDeps does not match the reviewed hold policy."
    ),
    cohortProblems(workspace),
    problemWhen(
      rootManifest.packageManager !== PACKAGE_MANAGER,
      `packageManager must be ${PACKAGE_MANAGER}.`
    ),
    problemWhen(
      rootManifest.devEngines?.runtime?.version !== "24.21.0",
      "The managed Node runtime must be 24.21.0."
    ),
  ]);
}
