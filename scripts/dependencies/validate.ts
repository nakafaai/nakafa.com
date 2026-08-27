import ts from "typescript";
import {
  DEPENDENCY_HOLDS,
  DEPENDENCY_RELEASE_AGE_EXCLUSIONS,
  DEPENDENCY_RELEASE_AGE_MINUTES,
  FORBIDDEN_EFFECT_DEPENDENCIES,
  SCRIPT_DEPENDENCY_HOLDS,
  TEMPORARY_DEPENDENCY_HOLDS,
} from "./policy.ts";
import type {
  FirstPartyManifest,
  PackageManifest,
  WorkspaceManifest,
} from "./source.ts";

interface DependencyPolicyInput {
  readonly files: readonly DependencyPolicyFile[];
  readonly manifests: readonly FirstPartyManifest[];
  readonly rootManifest: PackageManifest;
  readonly workspace: WorkspaceManifest;
}

export interface DependencyPolicyFile {
  readonly path: string;
  readonly source: string;
}

const DEPENDENCY_GROUPS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

function matchesDependency(specifier: string, dependency: string) {
  return specifier === dependency || specifier.startsWith(`${dependency}/`);
}

function importsDependency(
  { path, source }: DependencyPolicyFile,
  dependency: string
) {
  if (!source.includes(dependency)) {
    return false;
  }
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    false,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  let found = false;

  function visit(node: ts.Node) {
    if (found) {
      return;
    }

    let specifier: ts.Expression | undefined;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      specifier = node.moduleSpecifier;
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      specifier = node.moduleReference.expression;
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      specifier = node.arguments[0];
    }

    if (
      specifier !== undefined &&
      ts.isStringLiteralLike(specifier) &&
      matchesDependency(specifier.text, dependency)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

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

/** Validates one exact, owned dependency retained only during a rollout. */
function validateTemporaryDependencyHolds(
  manifests: readonly FirstPartyManifest[],
  files: readonly DependencyPolicyFile[]
) {
  const problems: string[] = [];
  const filesByPath = new Map(files.map((file) => [file.path, file.source]));
  for (const hold of TEMPORARY_DEPENDENCY_HOLDS) {
    const declarations = dependencyDeclarations(manifests, hold.dependency);
    if (declarations.length !== 1) {
      problems.push(
        `${hold.dependency} has ${declarations.length} declarations; expected exactly one temporary declaration.`
      );
    }
    for (const declaration of declarations) {
      if (
        declaration.manifestPath !== hold.manifestPath ||
        declaration.group !== hold.group ||
        declaration.spec !== hold.approved
      ) {
        problems.push(
          `${declaration.manifestPath} declares temporary ${hold.dependency} as ${declaration.spec} in ${declaration.group}; approved ${hold.approved} in ${hold.manifestPath} ${hold.group}.`
        );
      }
    }
    if (
      hold.owner.length === 0 ||
      hold.exitCriterion.length === 0 ||
      hold.cleanup.length === 0 ||
      hold.consumers.length === 0
    ) {
      problems.push(
        `${hold.dependency} must retain an owner, exit criterion, and cleanup scope.`
      );
    }

    const actualConsumers = files
      .filter((file) => importsDependency(file, hold.dependency))
      .map(({ path }) => path)
      .sort();
    const approvedConsumers = [...hold.consumers].sort();
    if (JSON.stringify(actualConsumers) !== JSON.stringify(approvedConsumers)) {
      problems.push(
        `${hold.dependency} consumers are ${actualConsumers.join(", ") || "none"}; approved ${approvedConsumers.join(", ")}.`
      );
    }

    for (const target of hold.cleanup) {
      const separator = target.indexOf("#");
      const path = separator === -1 ? target : target.slice(0, separator);
      const marker = separator === -1 ? null : target.slice(separator + 1);
      const source = filesByPath.get(path);
      if (source === undefined) {
        problems.push(
          `${hold.dependency} cleanup target ${path} is missing from the inspected repository.`
        );
      } else if (marker !== null && !source.includes(marker)) {
        problems.push(
          `${hold.dependency} cleanup target ${path} no longer contains ${marker}.`
        );
      }
    }
  }
  return problems;
}

/** Validates exact cohort declarations and the absence of v3 packages. */
export function validateDependencyPolicy({
  files,
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

  problems.push(...validateTemporaryDependencyHolds(manifests, files));

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
