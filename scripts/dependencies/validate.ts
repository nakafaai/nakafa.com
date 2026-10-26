import {
  Array as Arr,
  Equivalence,
  Option,
  Order,
  Record as Rec,
  String as Str,
} from "effect";
import {
  AI_SDK_COHORT,
  DEPENDENCY_HOLDS,
  EFFECT_COHORT_OVERRIDES,
  EFFECT_COHORT_VERSION,
  NODE_RUNTIME_VERSION,
  OBSOLETE_DEPENDENCIES,
  PACKAGE_MANAGER,
  RETIRED_LOCK_PACKAGES,
  SCRIPT_DEPENDENCY_HOLDS,
  VITEST_COHORT_VERSION,
} from "#scripts/dependencies/policy";
import type {
  DependencyPolicyInput,
  FirstPartyManifest,
  WorkspaceManifest,
} from "#scripts/dependencies/source";
import { problemWhen } from "#scripts/problem";

const DEPENDENCY_GROUPS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

/** Compares two lists of names or paths, element by element and in order. */
const sameStrings = Equivalence.Array(Equivalence.String);

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
    const allowed = Arr.dedupe(
      "allowed" in hold ? hold.allowed : [hold.approved]
    );
    return Arr.flatten([
      "declarationPaths" in hold
        ? problemWhen(
            !sameStrings(actualPaths, expectedPaths),
            `${hold.dependency} declarations are ${Arr.join(actualPaths, ", ") || "missing"}; expected ${Arr.join(expectedPaths, ", ")}.`
          )
        : problemWhen(
            declarations.length < hold.minimumDeclarations,
            `${hold.dependency} has ${declarations.length} declarations; expected at least ${hold.minimumDeclarations}.`
          ),
      Arr.flatMap(declarations, (declaration) =>
        problemWhen(
          !Arr.contains(allowed, declaration.spec),
          `${declaration.manifestPath} declares ${hold.dependency} as ${declaration.spec}; approved ${Arr.join(allowed, " or ")}.`
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

/**
 * Reports each retired package that the lock resolves. A resolved package is a
 * packages entry whose array starts with "<name>@<version>"; a peer declaration
 * names the package only as a key or a list item, so it never matches.
 */
function lockProblems(lock: string) {
  return Arr.flatMap(
    Rec.toEntries(RETIRED_LOCK_PACKAGES),
    ([dependency, replacement]) =>
      problemWhen(
        Str.includes(`["${dependency}@`)(lock),
        `bun.lock resolves the retired package ${dependency}; ${replacement} replaces it.`
      )
  );
}

/** The dependencies that routine updates leave to their reviewed holds. */
export function heldDependencyNames(): readonly string[] {
  return Arr.sort(
    Arr.dedupe([
      ...Arr.map(DEPENDENCY_HOLDS, ({ dependency }) => dependency),
      "node",
    ]),
    Order.String
  );
}

/** Validates exact cohort declarations, retired packages, and the lock. */
export function validateDependencyPolicy({
  lock,
  manifests,
  rootManifest,
  workspace,
}: DependencyPolicyInput) {
  return Arr.flatten([
    declarationProblems(manifests),
    lockProblems(lock),
    Arr.flatMap(
      Rec.toEntries(OBSOLETE_DEPENDENCIES),
      ([dependency, replacement]) =>
        Arr.map(
          dependencyDeclarations(manifests, dependency),
          (declaration) =>
            `${declaration.manifestPath} declares the obsolete dependency ${dependency}; use ${replacement}.`
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
    cohortProblems(workspace),
    problemWhen(
      rootManifest.packageManager !== PACKAGE_MANAGER,
      `packageManager must be ${PACKAGE_MANAGER}.`
    ),
    problemWhen(
      rootManifest.devEngines?.runtime?.version !== NODE_RUNTIME_VERSION,
      `The managed Node runtime must be ${NODE_RUNTIME_VERSION}.`
    ),
  ]);
}
