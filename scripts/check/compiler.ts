import {
  Array as Arr,
  Effect,
  Equal,
  FileSystem,
  Option,
  Path,
  Predicate,
  Record as Rec,
  Schema,
} from "effect";
import type { RepositorySource } from "#scripts/check/source";

const PLUGIN_NAME = "@effect/language-service";
/** The folder of the shared configurations, and the manifest that names their package. */
const SHARED_ROOT = "packages/typescript-config/";
const PACKAGE_FILE = "package.json";
/** The shared configurations every workspace extends. */
const SHARED_CONFIG_PATTERN =
  /^packages\/typescript-config\/(?!package\.json$)[^/]+\.json$/u;
/** One workspace's own configuration, such as `tsconfig.json`. */
const WORKSPACE_CONFIG_PATTERN = /(?:^|\/)tsconfig(?:\.[^/]+)?\.json$/u;

const CompilerConfig = Schema.fromJsonString(
  Schema.Struct({
    compilerOptions: Schema.optionalKey(
      Schema.Struct({
        plugins: Schema.optionalKey(
          Schema.Array(Schema.Record(Schema.String, Schema.Unknown))
        ),
      })
    ),
    extends: Schema.optionalKey(Schema.Unknown),
  })
);
const decodeConfig = Schema.decodeUnknownOption(CompilerConfig);
/** The package manifest of the shared configurations, which declares the package's name. */
const PackageManifest = Schema.fromJsonString(
  Schema.Struct({ name: Schema.String })
);

/** The repository's shared compiler configuration package cannot be named. */
export class SharedPackageError extends Schema.TaggedError<SharedPackageError>()(
  "SharedPackageError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Whether a repository-relative path names a compiler configuration. */
export function isCompilerConfig(file: string) {
  return (
    SHARED_CONFIG_PATTERN.test(file) || WORKSPACE_CONFIG_PATTERN.test(file)
  );
}

/**
 * Reads the package name that the repository declares for its shared compiler
 * configurations, so the policy names the repository's own package and no other.
 */
export const sharedPackageName = Effect.fn(
  "RepositoryPolicy.sharedPackageName"
)(function* (root: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const source = yield* fileSystem
    .readFileString(path.join(root, SHARED_ROOT, PACKAGE_FILE))
    .pipe(
      Effect.mapError((cause) =>
        SharedPackageError.make({
          cause,
          message: `${SHARED_ROOT}${PACKAGE_FILE} is missing or unreadable, so the compiler configuration policy cannot name the shared package.`,
        })
      )
    );
  const manifest = yield* Schema.decodeEffect(PackageManifest)(source).pipe(
    Effect.mapError((cause) =>
      SharedPackageError.make({
        cause,
        message: `${SHARED_ROOT}${PACKAGE_FILE} must be JSON with a string name, so the compiler configuration policy cannot name the shared package.`,
      })
    )
  );
  return manifest.name;
});

/** Joins a relative path onto a folder, resolving `.` and `..` segments. */
function resolveRelative(folder: readonly string[], relative: string) {
  return Arr.join(
    Arr.reduce(relative.split("/"), folder, (resolved, segment) => {
      if (segment === "..") {
        return Arr.dropRight(resolved, 1);
      }
      return segment === "." ? resolved : Arr.append(resolved, segment);
    }),
    "/"
  );
}

/**
 * Returns the configuration an `extends` value names: a shared one by the shared
 * package's name, or any one by a path relative to `file`. Any other value, such
 * as a list or a package preset, names nothing the check can follow.
 */
function parentOf(file: string, parent: unknown, sharedPrefix: string) {
  if (!Predicate.isString(parent)) {
    return Option.none();
  }
  if (parent.startsWith(sharedPrefix)) {
    return Option.some(`${SHARED_ROOT}${parent.slice(sharedPrefix.length)}`);
  }
  return parent.startsWith(".")
    ? Option.some(resolveRelative(Arr.dropRight(file.split("/"), 1), parent))
    : Option.none();
}

/**
 * Reports compiler configurations that would run the typecheck without the
 * shared Effect language service rules. A `plugins` array replaces the one it
 * extends, so only shared configurations declare one, each of them carries
 * the same Effect block, and every other configuration reaches such a block
 * through what it extends. A configuration the check cannot read or follow is
 * reported instead of skipped.
 */
export function inspectCompilerConfigs(
  sharedPackage: string,
  configs: readonly (typeof RepositorySource.Type)[]
) {
  const sharedPrefix = `${sharedPackage}/`;
  const inspected = Arr.map(configs, ({ file, sourceText }) => {
    const config = decodeConfig(sourceText);
    return {
      block: Option.flatMap(config, ({ compilerOptions }) =>
        Arr.findFirst(
          compilerOptions?.plugins ?? [],
          (plugin) => plugin.name === PLUGIN_NAME
        )
      ),
      config,
      file,
      shared: SHARED_CONFIG_PATTERN.test(file),
    };
  });
  const byFile = Rec.fromIterableWith(inspected, (entry) => [
    entry.file,
    entry,
  ]);
  const reference = Arr.head(
    Arr.flatMap(inspected, ({ block, file, shared }) =>
      shared && Option.isSome(block) ? [{ block: block.value, file }] : []
    )
  );
  /**
   * Whether a configuration receives the block: from its own plugins or, when
   * it declares none, from the configuration it extends. `depth` bounds the
   * walk, so a cycle of configurations receives nothing.
   */
  const receives = (file: string, depth: number): boolean =>
    Option.match(
      Option.flatMap(Rec.get(byFile, file), (entry) =>
        Option.map(entry.config, (config) => ({ config, entry }))
      ),
      {
        onNone: () => false,
        onSome: ({ config, entry }) =>
          config.compilerOptions?.plugins === undefined
            ? depth > 0 &&
              Option.match(parentOf(file, config.extends, sharedPrefix), {
                onNone: () => false,
                onSome: (parent) => receives(parent, depth - 1),
              })
            : Option.isSome(entry.block),
      }
    );
  return Arr.flatMap(inspected, ({ block, config, file, shared }) => {
    if (Option.isNone(config)) {
      return [
        `${file}: write this compiler configuration as plain JSON, without comments or trailing commas, so the check can read its plugins.`,
      ];
    }
    const plugins = config.value.compilerOptions?.plugins;
    if (!shared && plugins !== undefined) {
      return [
        `${file}: remove its plugins array and inherit the shared one, because a plugins array replaces the one it extends.`,
      ];
    }
    if (plugins !== undefined && Option.isNone(block)) {
      return [
        `${file}: add the ${PLUGIN_NAME} block to its plugins array, because a plugins array replaces the one it extends.`,
      ];
    }
    if (!receives(file, inspected.length)) {
      return [
        `${file}: extend a shared configuration that declares the ${PLUGIN_NAME} block, by its ${sharedPrefix} name or by a relative path, or declare the block in a shared configuration that extends nothing.`,
      ];
    }
    return Option.match(Option.all({ block, reference }), {
      onNone: () => [],
      onSome: (found) =>
        Equal.equals(found.block, found.reference.block)
          ? []
          : [
              `${file}: its ${PLUGIN_NAME} block differs from ${found.reference.file}; keep them identical so every workspace enforces the same rules.`,
            ],
    });
  });
}
