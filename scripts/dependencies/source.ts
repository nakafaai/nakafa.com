import { Array as Arr, Effect, FileSystem, Path, Schema } from "effect";
import { parse } from "yaml";
import { validateDependencyPolicy } from "#scripts/dependencies/validate";

const StringMap = Schema.Record(Schema.String, Schema.String);
const PackageManifest = Schema.Struct({
  dependencies: Schema.optional(StringMap),
  devDependencies: Schema.optional(StringMap),
  devEngines: Schema.optional(
    Schema.Struct({
      runtime: Schema.optional(
        Schema.Struct({ version: Schema.optional(Schema.String) })
      ),
    })
  ),
  optionalDependencies: Schema.optional(StringMap),
  packageManager: Schema.optional(Schema.String),
  peerDependencies: Schema.optional(StringMap),
  scripts: Schema.optional(StringMap),
});
const WorkspaceManifest = Schema.Struct({
  catalog: Schema.optional(StringMap),
  overrides: Schema.optional(StringMap),
  update: Schema.optional(
    Schema.Struct({ ignoreDeps: Schema.optional(Schema.Array(Schema.String)) })
  ),
});

export type PackageManifest = typeof PackageManifest.Type;
export type WorkspaceManifest = typeof WorkspaceManifest.Type;

export interface FirstPartyManifest {
  readonly manifest: PackageManifest;
  readonly path: string;
}

/** Expected failure while reading or decoding dependency policy files. */
export class DependencyPolicyReadError extends Schema.TaggedError<DependencyPolicyReadError>()(
  "DependencyPolicyReadError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

function readError(message: string, cause: unknown) {
  return new DependencyPolicyReadError({ cause, message });
}

const readPackageManifest = Effect.fn("RepositoryPolicy.readPackageManifest")(
  function* (manifestPath: string) {
    const fileSystem = yield* FileSystem.FileSystem;
    const source = yield* fileSystem
      .readFileString(manifestPath)
      .pipe(
        Effect.mapError((cause) =>
          readError(`Unable to read ${manifestPath}.`, cause)
        )
      );
    const input = yield* Effect.try({
      try: (): unknown => JSON.parse(source),
      catch: (cause) =>
        readError(`${manifestPath} does not contain valid JSON.`, cause),
    });
    return yield* Schema.decodeUnknownEffect(PackageManifest)(input).pipe(
      Effect.mapError((cause) =>
        readError(`${manifestPath} has an invalid package manifest.`, cause)
      )
    );
  }
);

const readWorkspaceManifest = Effect.fn(
  "RepositoryPolicy.readWorkspaceManifest"
)(function* (workspacePath: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  const source = yield* fileSystem
    .readFileString(workspacePath)
    .pipe(
      Effect.mapError((cause) =>
        readError(`Unable to read ${workspacePath}.`, cause)
      )
    );
  const input = yield* Effect.try({
    try: () => parse(source),
    catch: (cause) =>
      readError(`${workspacePath} does not contain valid YAML.`, cause),
  });
  return yield* Schema.decodeUnknownEffect(WorkspaceManifest)(input).pipe(
    Effect.mapError((cause) =>
      readError(`${workspacePath} has an invalid workspace manifest.`, cause)
    )
  );
});

/** Reads every first-party package manifest without entering vendored source. */
export const readFirstPartyManifests = Effect.fn(
  "RepositoryPolicy.readFirstPartyManifests"
)(function* (root: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const workspaceManifestPaths = yield* Effect.forEach(
    ["apps", "packages"],
    Effect.fnUntraced(function* (workspaceDirectory) {
      const workspaceRoot = path.join(root, workspaceDirectory);
      const entries = yield* fileSystem
        .readDirectory(workspaceRoot)
        .pipe(
          Effect.mapError((cause) =>
            readError(`Unable to read ${workspaceRoot}.`, cause)
          )
        );
      const directories = yield* Effect.filter(entries, (entry) =>
        fileSystem.stat(path.join(workspaceRoot, entry)).pipe(
          Effect.map((info) => info.type === "Directory"),
          Effect.mapError((cause) =>
            readError(
              `Unable to inspect ${path.join(workspaceRoot, entry)}.`,
              cause
            )
          )
        )
      );
      return Arr.map(directories, (entry) =>
        path.join(workspaceRoot, entry, "package.json")
      );
    })
  );
  const manifestPaths = Arr.prepend(
    Arr.flatten(workspaceManifestPaths),
    path.join(root, "package.json")
  );

  return yield* Effect.forEach(manifestPaths, (manifestPath) =>
    readPackageManifest(manifestPath).pipe(
      Effect.map((manifest) => ({
        manifest,
        path: path.relative(root, manifestPath),
      }))
    )
  );
});

/** Reads and validates the repository dependency policy. */
export const inspectDependencyPolicy = Effect.fn(
  "RepositoryPolicy.inspectDependencies"
)(function* (root: string) {
  const path = yield* Path.Path;
  const rootManifest = yield* readPackageManifest(
    path.join(root, "package.json")
  );
  const workspace = yield* readWorkspaceManifest(
    path.join(root, "pnpm-workspace.yaml")
  );
  const manifests = yield* readFirstPartyManifests(root);
  return validateDependencyPolicy({
    manifests,
    rootManifest,
    workspace,
  });
});
