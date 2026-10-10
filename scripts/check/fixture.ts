import { Array as Arr, Effect, Record as Rec, Result } from "effect";
import { isProjectConfig } from "#scripts/check/arrays";
import { openCompiler, parseSources } from "#scripts/check/source";

/** The virtual repository root that fixture files are written under. */
export const ROOT = "/fixture";
/** The file name of a project configuration. */
export const PROJECT_CONFIG = "tsconfig.json";
/** A project that loads the bundled libraries and judges every `.ts` module below it. */
export const PROJECT =
  '{"compilerOptions":{"moduleResolution":"bundler","module":"esnext","noEmit":true,"strict":true,"target":"es2022"},"include":["**/*.ts"]}\n';

/** Adds the root project to fixture files, so that each module has a project to judge it. */
export const withProject = (files: Readonly<Record<string, string>>) => ({
  [PROJECT_CONFIG]: PROJECT,
  ...files,
});

/** Keys fixture files by their paths in the virtual file system. */
const virtualFiles = (files: Readonly<Record<string, string>>) =>
  Rec.fromEntries(
    Arr.map(Rec.toEntries(files), ([file, text]): [string, string] => [
      `${ROOT}/${file}`,
      text,
    ])
  );

/**
 * Opens a scoped compiler over fixture files, and parses the modules among them
 * for the syntax rules. Configuration files name projects and are not parsed.
 */
export const fixture = Effect.fn("ArrayTest.fixture")(function* (
  files: Readonly<Record<string, string>>
) {
  const sources = Arr.filterMap(Rec.toEntries(files), ([file, sourceText]) =>
    isProjectConfig(file)
      ? Result.failVoid
      : Result.succeed({ file, sourceText })
  );
  const parsed = yield* parseSources(sources);
  const api = yield* openCompiler(
    virtualFiles(files),
    "Unable to start the array fixture compiler."
  );
  return {
    api,
    configs: Arr.filter(Rec.keys(files), isProjectConfig),
    modules: parsed.modules,
  };
});

/**
 * Opens a scoped snapshot of the fixture's root project, and returns the project
 * so that a test can read its program and checker.
 */
export const typedProject = Effect.fn("ArrayTest.typedProject")(function* (
  files: Readonly<Record<string, string>>
) {
  const api = yield* openCompiler(
    virtualFiles(files),
    "Unable to start the array fixture compiler."
  );
  const configPath = `${ROOT}/${PROJECT_CONFIG}`;
  const snapshot = yield* Effect.acquireRelease(
    Effect.sync(() =>
      api.updateSnapshot({ openProjects: [configPath], closeProjects: [] })
    ),
    (resource) => Effect.sync(() => resource.dispose())
  );
  return yield* Effect.fromNullishOr(snapshot.getProject(configPath));
});
