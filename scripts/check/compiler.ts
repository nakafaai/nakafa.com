import { Array as Arr, Equal, Option, Schema } from "effect";
import type { RepositorySource } from "#scripts/check/source";

const PLUGIN_NAME = "@effect/language-service";
/** The shared configurations every workspace extends. */
const SHARED_CONFIG_PATTERN = /^packages\/typescript-config\/[^/]+\.json$/u;
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
  })
);
const decodeConfig = Schema.decodeUnknownOption(CompilerConfig);

/** Whether a repository-relative path names a compiler configuration. */
export function isCompilerConfig(file: string) {
  return (
    SHARED_CONFIG_PATTERN.test(file) || WORKSPACE_CONFIG_PATTERN.test(file)
  );
}

/** Returns the Effect language service block one configuration declares. */
function languageService(source: typeof RepositorySource.Type) {
  return Option.map(
    Option.flatMap(decodeConfig(source.sourceText), (config) =>
      Arr.findFirst(
        config.compilerOptions?.plugins ?? [],
        (plugin) => plugin.name === PLUGIN_NAME
      )
    ),
    (plugin) => ({ file: source.file, plugin })
  );
}

/**
 * Reports compiler configurations that would run the typecheck with their own
 * Effect language service rules. A `plugins` array replaces the one it
 * extends, so every shared configuration that declares the plugin declares the
 * same block, and no workspace configuration declares one.
 */
export function inspectCompilerConfigs(
  configs: readonly (typeof RepositorySource.Type)[]
) {
  const declared = Arr.getSomes(Arr.map(configs, languageService));
  const shared = Arr.filter(declared, ({ file }) =>
    SHARED_CONFIG_PATTERN.test(file)
  );
  return Arr.appendAll(
    Arr.map(
      Arr.filter(declared, ({ file }) => !SHARED_CONFIG_PATTERN.test(file)),
      ({ file }) =>
        `${file}: remove the ${PLUGIN_NAME} block and inherit it from the shared configuration, because a plugins array replaces the one it extends.`
    ),
    Option.match(Arr.head(shared), {
      onNone: () => [],
      onSome: (reference) =>
        Arr.map(
          Arr.filter(
            shared,
            ({ plugin }) => !Equal.equals(plugin, reference.plugin)
          ),
          ({ file }) =>
            `${file}: its ${PLUGIN_NAME} block differs from ${reference.file}; keep them identical so every workspace enforces the same rules.`
        ),
    })
  );
}
