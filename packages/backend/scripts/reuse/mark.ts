import { Array as Arr, Effect, FileSystem, Path, String as Str } from "effect";

/**
 * The export that makes Convex keep a module's JavaScript context after a call, so
 * the next call of that module runs its handler without evaluating the module
 * again (ADR 0040). Confect writes these modules and has no option for it.
 */
const REUSE_EXPORT = "export const experimental_reuseContext = true;";

/** The import that every module Confect writes opens with. */
const CONFECT_MODULE = "confect/_generated/registeredFunctions/";

/** Only the Convex runtime reuses a context, so a module that runs in Node stays as it is. */
const NODE_MODULE = '"use node"';

const isCandidate = (entry: string) =>
  Str.endsWith(".ts")(entry) && !Str.startsWith("_generated")(entry);

const lacksReuse = (source: string) =>
  Str.includes(CONFECT_MODULE)(source) &&
  !Str.includes(NODE_MODULE)(source) &&
  !Str.includes(REUSE_EXPORT)(source);

/** Adds the reuse export to every module under the folder that Confect wrote and lacks it. */
export const markModules = Effect.fn("Reuse.markModules")(function* (
  functionsDirectory: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* fs.readDirectory(functionsDirectory, {
    recursive: true,
  });
  yield* Effect.forEach(Arr.filter(entries, isCandidate), (entry) =>
    Effect.gen(function* () {
      const file = path.join(functionsDirectory, entry);
      const source = yield* fs.readFileString(file);
      if (lacksReuse(source)) {
        yield* fs.writeFileString(file, `${source}${REUSE_EXPORT}\n`);
      }
    })
  );
});
