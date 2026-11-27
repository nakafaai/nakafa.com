import {
  Array as Arr,
  Effect,
  FileSystem,
  HashSet,
  Order,
  Path,
  Result,
  Schema,
  String as Str,
} from "effect";
import { RepositoryReadError } from "#scripts/check/files";
import { LAB_PAGE } from "#scripts/check/labs";

/** The folder of the engine whose modules the lab page catalogues. */
export const ENGINE_DIRECTORY = "packages/design-system/components/three";
/** How the page names an engine module: in code, as `three/<module>`. */
const NAMED_PATTERN = /`three\/[a-z]+`/gu;
const NAMED_PREFIX = "`three/";
const MODULE_PATTERN = /^[a-z]+\.tsx?$/u;
const EXTENSION_PATTERN = /\.tsx?$/u;

/** One entry of the engine folder: its name, and whether it is a folder. */
const EngineEntry = Schema.Struct({
  directory: Schema.Boolean,
  name: Schema.String,
});

/**
 * Compares the modules the lab page names with the engine folder, so the
 * catalogue never goes stale: every folder of the engine is named on the
 * page, and every module the page names is a folder or a module of the engine.
 */
export function catalogueFindings(
  page: string,
  entries: readonly (typeof EngineEntry.Type)[]
): readonly string[] {
  const named = HashSet.fromIterable(
    Arr.map(Arr.fromIterable(page.matchAll(NAMED_PATTERN)), ([code]) =>
      Str.slice(NAMED_PREFIX.length, -1)(code)
    )
  );
  const folders = Arr.filterMap(entries, ({ directory, name }) =>
    directory ? Result.succeed(name) : Result.failVoid
  );
  const known = HashSet.fromIterable(
    Arr.appendAll(
      folders,
      Arr.filterMap(entries, ({ name }) =>
        MODULE_PATTERN.test(name)
          ? Result.succeed(Str.replace(EXTENSION_PATTERN, "")(name))
          : Result.failVoid
      )
    )
  );
  const missing = Arr.filterMap(folders, (folder) =>
    HashSet.has(named, folder)
      ? Result.failVoid
      : Result.succeed(
          `${LAB_PAGE}: three/${folder} is not in the catalogue: name it with what it gives and when a lab uses it.`
        )
  );
  const stale = Arr.filterMap(Arr.fromIterable(named), (module) =>
    HashSet.has(known, module)
      ? Result.failVoid
      : Result.succeed(
          `${LAB_PAGE}: three/${module} names no module of ${ENGINE_DIRECTORY}: remove it, or land the module first.`
        )
  );
  return Arr.appendAll(missing, Arr.sort(stale, Order.String));
}

/**
 * Reads the engine folder and the lab page of the repository at `root`, and
 * compares them. A repository without the engine folder has nothing to
 * catalogue.
 */
export const inspectCatalogue = Effect.fn("RepositoryPolicy.inspectCatalogue")(
  function* (root: string) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const engine = path.join(root, ENGINE_DIRECTORY);
    const page = path.join(root, LAB_PAGE);
    const unreadable = (target: string) => (cause: unknown) =>
      new RepositoryReadError({ cause, message: `Unable to read ${target}.` });
    if (!(yield* fileSystem.exists(engine))) {
      return [];
    }
    const names = yield* fileSystem
      .readDirectory(engine)
      .pipe(Effect.mapError(unreadable(engine)));
    const entries = yield* Effect.forEach(names, (name) =>
      Effect.map(
        fileSystem
          .stat(path.join(engine, name))
          .pipe(Effect.mapError(unreadable(name))),
        (info) => ({ directory: info.type === "Directory", name })
      )
    );
    const text = (yield* fileSystem.exists(page))
      ? yield* fileSystem
          .readFileString(page)
          .pipe(Effect.mapError(unreadable(page)))
      : "";
    return catalogueFindings(text, entries);
  }
);
