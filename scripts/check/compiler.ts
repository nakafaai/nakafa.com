import { Array as Arr, Equal, Option, Schema } from "effect";
import type { RepositorySource } from "#scripts/check/source";

const PLUGIN_NAME = "@effect/language-service";
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

/** Whether a repository-relative path names a compiler configuration. */
export function isCompilerConfig(file: string) {
  return (
    SHARED_CONFIG_PATTERN.test(file) || WORKSPACE_CONFIG_PATTERN.test(file)
  );
}

/**
 * Reports what one shared configuration declares wrongly: a `plugins` array
 * without the Effect language service block, or no block at all in a
 * configuration that extends nothing.
 */
function sharedProblems(
  file: string,
  config: typeof CompilerConfig.Type,
  block: Option.Option<Readonly<Record<string, unknown>>>
) {
  if (Option.isSome(block)) {
    return [];
  }
  if (config.compilerOptions?.plugins !== undefined) {
    return [
      `${file}: add the ${PLUGIN_NAME} block to its plugins array, because a plugins array replaces the one it extends.`,
    ];
  }
  return config.extends === undefined
    ? [
        `${file}: declare the ${PLUGIN_NAME} block, because it extends no configuration that provides one.`,
      ]
    : [];
}

/**
 * Reports compiler configurations that would run the typecheck without the
 * shared Effect language service rules. A `plugins` array replaces the one it
 * extends, so only shared configurations declare one, each of them carries
 * the same Effect block, and a configuration the check cannot read is
 * reported instead of skipped.
 */
export function inspectCompilerConfigs(
  configs: readonly (typeof RepositorySource.Type)[]
) {
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
  const reference = Arr.head(
    Arr.flatMap(inspected, ({ block, file, shared }) =>
      shared && Option.isSome(block) ? [{ block: block.value, file }] : []
    )
  );
  return Arr.flatMap(inspected, ({ block, config, file, shared }) => {
    if (Option.isNone(config)) {
      return [
        `${file}: write this compiler configuration as plain JSON, without comments or trailing commas, so the check can read its plugins.`,
      ];
    }
    if (!shared) {
      return config.value.compilerOptions?.plugins === undefined
        ? []
        : [
            `${file}: remove its plugins array and inherit the shared one, because a plugins array replaces the one it extends.`,
          ];
    }
    return Arr.appendAll(
      sharedProblems(file, config.value, block),
      Option.match(Option.all({ block, reference }), {
        onNone: () => [],
        onSome: (found) =>
          Equal.equals(found.block, found.reference.block)
            ? []
            : [
                `${file}: its ${PLUGIN_NAME} block differs from ${found.reference.file}; keep them identical so every workspace enforces the same rules.`,
              ],
      })
    );
  });
}
