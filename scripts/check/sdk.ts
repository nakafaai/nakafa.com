import {
  Array as Arr,
  Effect,
  FileSystem,
  HashMap,
  MutableHashSet,
  MutableList,
  Option,
  Order,
  Path,
  Result,
  String as Str,
  Tuple,
} from "effect";
import {
  isExportDeclaration,
  isImportDeclaration,
  isStringLiteral,
  type SourceFile,
} from "typescript/unstable/ast";
import { loadsExport, loadsImport } from "#scripts/check/kinds";
import { resolveSpecifier } from "#scripts/check/page";
import { parseSources, type RepositorySource } from "#scripts/check/source";

/** The package specifier that names a backend module, such as `@repo/backend/confect/nina/usage`. */
const BACKEND_SPECIFIER = "@repo/backend/";
/** The folder of the backend package, which holds every backend module. */
const BACKEND_FOLDER = "packages/backend/";
/** Every TypeScript module of the backend, generated output included, since a generated module loads authored ones. */
const BACKEND_MODULE_PATTERN = /^packages\/backend\/.+\.ts$/u;
/** Declaration files and tests are never loaded by a function, so no chain runs through them. */
const NON_RUNTIME_PATTERN = /\.(?:d|test)\.ts$/u;
/**
 * The modules that Convex loads for every function: each Confect spec, each table,
 * and the schema root that every function loads. A domain schema is reached through
 * these when they load it, so it is never a start on its own.
 */
const START_PATTERNS = [
  /^packages\/backend\/confect\/(?:.+\/)?[^/]+\.spec\.ts$/u,
  /^packages\/backend\/confect\/tables\/[^/]+\.ts$/u,
  /^packages\/backend\/confect\/_generated\/schema\.ts$/u,
];
/** The AI SDK, its providers, and Agent, which no module that those starts load may import. */
const SDK_PACKAGE_PATTERN =
  /^(?:ai(?:\/.*)?|@ai-sdk\/.*|@convex-dev\/agent(?:\/.*)?)$/u;
const RULE =
  "move the AI SDK import out of the module that specs and tables load";

/** A backend module on a chain of loaded modules, which runs from a start module to this one. */
interface Route {
  readonly chain: readonly string[];
  readonly file: string;
  readonly sourceFile: SourceFile;
}

/** Whether a module is a start: a spec, a table, or the schema root that Convex loads for every function. */
function isStart(file: string) {
  return Arr.some(START_PATTERNS, (pattern) => pattern.test(file));
}

/** The backend module that a value specifier names from `file`, or none for a package or another module. */
function loadedFile(file: string, specifier: string) {
  if (specifier.startsWith(BACKEND_SPECIFIER)) {
    return Option.some(
      `${BACKEND_FOLDER}${specifier.slice(BACKEND_SPECIFIER.length)}.ts`
    );
  }
  return Option.fromNullishOr(
    Result.getOrUndefined(
      Result.map(resolveSpecifier(file, specifier), (key) => `${key}.ts`)
    )
  );
}

/** The specifiers of the value imports and re-exports of a module: type-only ones load nothing. */
function loadedSpecifiers(sourceFile: SourceFile) {
  return Arr.filterMap(sourceFile.statements, (statement) => {
    if (
      isImportDeclaration(statement) &&
      loadsImport(statement) &&
      isStringLiteral(statement.moduleSpecifier)
    ) {
      return Result.succeed(statement.moduleSpecifier.text);
    }
    if (
      isExportDeclaration(statement) &&
      loadsExport(statement) &&
      statement.moduleSpecifier !== undefined &&
      isStringLiteral(statement.moduleSpecifier)
    ) {
      return Result.succeed(statement.moduleSpecifier.text);
    }
    return Result.failVoid;
  });
}

/** The backend modules that a route's module loads, each with its parsed source. */
function loadedModules(
  modules: HashMap.HashMap<string, SourceFile>,
  route: Route
) {
  return Arr.filterMap(loadedSpecifiers(route.sourceFile), (specifier) =>
    Option.match(
      Option.flatMap(loadedFile(route.file, specifier), (file) =>
        Option.map(HashMap.get(modules, file), (sourceFile) => ({
          file,
          sourceFile,
        }))
      ),
      {
        onNone: () => Result.failVoid,
        onSome: (loaded) => Result.succeed(loaded),
      }
    )
  );
}

/**
 * Walks the loaded modules breadth first from the start routes. A module keeps the
 * first chain that reaches it, which is the shortest one, so a module that a start
 * loads directly is never reported through a longer chain.
 */
function reachedRoutes(
  modules: HashMap.HashMap<string, SourceFile>,
  starts: readonly Route[]
) {
  const pending = MutableList.make<Route>();
  const reached = MutableList.make<Route>();
  const seen = MutableHashSet.fromIterable(Arr.map(starts, ({ file }) => file));
  for (const start of starts) {
    MutableList.append(pending, start);
  }
  for (
    let route = MutableList.take(pending);
    route !== MutableList.Empty;
    route = MutableList.take(pending)
  ) {
    MutableList.append(reached, route);
    for (const loaded of loadedModules(modules, route)) {
      if (!MutableHashSet.has(seen, loaded.file)) {
        MutableHashSet.add(seen, loaded.file);
        MutableList.append(pending, {
          file: loaded.file,
          chain: Arr.append(route.chain, loaded.file),
          sourceFile: loaded.sourceFile,
        });
      }
    }
  }
  return MutableList.takeAll(reached);
}

/** One finding per reached module that imports the AI SDK, Agent, or an AI SDK provider. */
function sdkFindings(routes: readonly Route[]) {
  return Arr.filterMap(routes, (route) => {
    const names = Arr.dedupe(
      Arr.filter(loadedSpecifiers(route.sourceFile), (specifier) =>
        SDK_PACKAGE_PATTERN.test(specifier)
      )
    );
    return Arr.isReadonlyArrayEmpty(names)
      ? Result.failVoid
      : Result.succeed(
          `${Arr.join(route.chain, " -> ")} imports ${Arr.join(
            Arr.map(names, (name) => `"${name}"`),
            ", "
          )}: ${RULE}.`
        );
  });
}

/**
 * Reports each backend module that a spec, a table, or the schema root loads through
 * value imports and re-exports, when that module imports the AI SDK, Agent, or an AI
 * SDK provider. Each finding names the shortest chain that loads the module.
 */
export const reachFindings = Effect.fn("RepositoryPolicy.reachFindings")(
  function* (sources: readonly (typeof RepositorySource.Type)[]) {
    if (!Arr.some(sources, ({ file }) => isStart(file))) {
      return [];
    }
    const parsed = yield* parseSources(sources);
    const modules = HashMap.fromIterable(
      Arr.map(parsed.modules, ({ file, sourceFile }) =>
        Tuple.make(file, sourceFile)
      )
    );
    const starts = Arr.sort(
      Arr.map(
        Arr.filter(parsed.modules, ({ file }) => isStart(file)),
        ({ file, sourceFile }): Route => ({ file, chain: [file], sourceFile })
      ),
      Order.mapInput(Order.String, (route: Route) => route.file)
    );
    return sdkFindings(reachedRoutes(modules, starts));
  },
  Effect.scoped
);

/**
 * Reads the backend modules among `files` with their generated output, and reports
 * each AI SDK import that a spec, a table, or the schema root loads. A repository
 * without a Confect backend has no start module, so it has no findings.
 */
export const inspectSdkReach = Effect.fn("RepositoryPolicy.inspectSdkReach")(
  function* (root: string, files: readonly string[]) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const relativePath = (file: string) =>
      Arr.join(Str.split(path.relative(root, file), path.sep), "/");
    const backend = Arr.filter(
      files,
      (file) =>
        BACKEND_MODULE_PATTERN.test(relativePath(file)) &&
        !NON_RUNTIME_PATTERN.test(relativePath(file))
    );
    const sources = yield* Effect.forEach(backend, (file) =>
      Effect.map(
        fileSystem.readFileString(file),
        (sourceText): typeof RepositorySource.Type => ({
          file: relativePath(file),
          sourceText,
        })
      )
    );
    return yield* reachFindings(sources);
  }
);
