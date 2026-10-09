import {
  Array as Arr,
  Effect,
  FileSystem,
  Option,
  Path,
  Record as Rec,
  Schema,
} from "effect";
import {
  type PackageManifest,
  readPackageManifest,
  readWorkspaceManifest,
  type WorkspaceManifest,
} from "#scripts/dependencies/source";

/**
 * Repository-relative files that the owner of this check shares with every
 * repository that runs it. A repository that holds one of them keeps an exact
 * copy of the owner's file.
 */
const SHARED_FILES = [
  "scripts/osv",
  "scripts/provenance/schema.ts",
  "scripts/provenance/bundle.ts",
  "scripts/provenance/verify.ts",
] as const;

/** Expected failure while reading a shared file that the check must compare. */
export class SharedFileError extends Schema.TaggedError<SharedFileError>()(
  "SharedFileError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Reads the text of one shared file, failing with a typed error that names the reason. */
const readShared = Effect.fn("RepositoryPolicy.readSharedFile")(function* (
  filePath: string,
  message: string
) {
  const fileSystem = yield* FileSystem.FileSystem;
  return yield* fileSystem
    .readFileString(filePath)
    .pipe(Effect.mapError((cause) => new SharedFileError({ cause, message })));
});

/**
 * Compares the text of one shared file that `root` holds with the owner's copy.
 * A file that `root` does not hold is not compared.
 */
const inspectSharedFile = Effect.fn("RepositoryPolicy.inspectSharedFile")(
  function* (root: string, owner: string, file: string) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const local = path.join(root, file);
    if (!(yield* fileSystem.exists(local))) {
      return [];
    }
    const copy = yield* readShared(
      local,
      `${file} cannot be read in this repository, so it cannot be compared with the owner's copy.`
    );
    const ownerCopy = yield* readShared(
      path.join(owner, file),
      `${file} of the repository that owns this check is missing or unreadable, so its copy cannot be compared.`
    );
    return copy === ownerCopy
      ? []
      : [
          `${file} differs from the copy in the repository that owns this check: change that copy first, then copy it here.`,
        ];
  }
);

/**
 * Compares the shared files of the repository at `root` with the owner's copies
 * at `owner`, and returns one finding line per divergent file. When both
 * folders resolve to the same place, the repository judges itself and nothing
 * is compared. A shared file that `root` does not hold is not a finding, since
 * a repository may not use that tool. A missing owner copy is a typed failure.
 */
export const inspectSharedFiles = Effect.fn(
  "RepositoryPolicy.inspectSharedFiles"
)(function* (root: string, owner: string) {
  const path = yield* Path.Path;
  if (path.resolve(root) === path.resolve(owner)) {
    return [];
  }
  const findings = yield* Effect.forEach(SHARED_FILES, (file) =>
    inspectSharedFile(root, owner, file)
  );
  return Arr.flatten(findings);
});

/** The Effect cohort: Effect, TypeScript, and the @effect packages, which move as one version. */
const COHORT_NAME = /^(?:effect|typescript|@effect\/.+)$/u;
const CATALOG_REFERENCE = "catalog:";
const PACKAGE_FILE = "package.json";
const WORKSPACE_FILE = "pnpm-workspace.yaml";

/** Reads the package manifest and the workspace manifest, where a repository declares its pins. */
const readManifests = Effect.fn("RepositoryPolicy.readCohortManifests")(
  function* (root: string) {
    const path = yield* Path.Path;
    const manifest = yield* readPackageManifest(path.join(root, PACKAGE_FILE));
    const workspace = yield* readWorkspaceManifest(
      path.join(root, WORKSPACE_FILE)
    );
    return { manifest, workspace };
  }
);

/**
 * Returns the version that a dependency reference pins: a literal version as
 * written, or the default catalog entry for `catalog:`. A named catalog is not
 * read, so a reference to one pins nothing.
 */
function resolveReference(
  name: string,
  reference: string,
  catalog: Readonly<Record<string, string>>
): Option.Option<string> {
  if (!reference.startsWith(CATALOG_REFERENCE)) {
    return Option.some(reference);
  }
  return reference === CATALOG_REFERENCE
    ? Rec.get(catalog, name)
    : Option.none();
}

/**
 * Returns the cohort version that one repository pins for a name. A dependency
 * in its package manifest decides it, as pnpm resolves it, and otherwise a
 * catalog entry of the same name does.
 */
function pinnedVersion(
  name: string,
  declared: Readonly<Record<string, string>>,
  catalog: Readonly<Record<string, string>>
): Option.Option<string> {
  return Option.match(Rec.get(declared, name), {
    onNone: () => Rec.get(catalog, name),
    onSome: (reference) => resolveReference(name, reference, catalog),
  });
}

/** Returns the cohort versions that one repository pins, by package name. */
function cohortPins(manifest: PackageManifest, workspace: WorkspaceManifest) {
  const catalog: Readonly<Record<string, string>> = workspace.catalog ?? {};
  const declared: Readonly<Record<string, string>> = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
  };
  const names = Arr.filter(
    Arr.dedupe(Arr.appendAll(Rec.keys(declared), Rec.keys(catalog))),
    (name) => COHORT_NAME.test(name)
  );
  return Rec.fromEntries(
    Arr.flatMap(names, (name) =>
      Option.match(pinnedVersion(name, declared, catalog), {
        onNone: () => [],
        onSome: (version): ReadonlyArray<readonly [string, string]> => [
          [name, version],
        ],
      })
    )
  );
}

/** Reports each name that both repositories pin at versions that differ. */
function divergentPins(
  local: Readonly<Record<string, string>>,
  owner: Readonly<Record<string, string>>
) {
  return Arr.flatMap(Rec.toEntries(local), ([name, version]) =>
    Option.match(Rec.get(owner, name), {
      onNone: () => [],
      onSome: (ownerVersion) =>
        ownerVersion === version
          ? []
          : [
              `${name} is pinned at ${version} here and at ${ownerVersion} in the repository that owns this check: set this pin to ${ownerVersion}, and move the Effect cohort in the owner first.`,
            ],
    })
  );
}

/**
 * Compares the Effect cohort pins of the repository at `root` with the owner's
 * pins at `owner`. Effect, TypeScript, and the @effect packages move as one
 * cohort, so a name that both repositories pin must have one version in both.
 * A name that only one of them pins is not a finding. Other tools, such as
 * Biome, Turborepo, esbuild, and pnpm, are each repository's own choice and are
 * not compared. A repository without a package manifest pins nothing. Any other
 * repository needs both manifests, and a missing one is a typed failure.
 */
export const inspectCohortPins = Effect.fn(
  "RepositoryPolicy.inspectCohortPins"
)(function* (root: string, owner: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (path.resolve(root) === path.resolve(owner)) {
    return [];
  }
  if (!(yield* fileSystem.exists(path.join(root, PACKAGE_FILE)))) {
    return [];
  }
  const local = yield* readManifests(root);
  const remote = yield* readManifests(owner);
  return divergentPins(
    cohortPins(local.manifest, local.workspace),
    cohortPins(remote.manifest, remote.workspace)
  );
});
