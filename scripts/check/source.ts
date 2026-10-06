import {
  Array as Arr,
  Effect,
  HashSet,
  MutableList,
  Record as Rec,
  Schema,
} from "effect";
import {
  type Identifier,
  isTypeNode,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { createVirtualFileSystem } from "typescript/unstable/fs";
import { API, type Symbol as NativeSymbol } from "typescript/unstable/sync";

/** One authored repository module and its text. */
export const RepositorySource = Schema.Struct({
  file: Schema.String,
  sourceText: Schema.String,
});

/**
 * What one identifier names in its module: an unshadowed platform global, an
 * imported binding, or a local declaration.
 */
export const Binding = Schema.Literals(["global", "import", "local"]);

/** The native compiler could not inspect repository sources. */
export class TestCompilerError extends Schema.TaggedError<TestCompilerError>()(
  "TestCompilerError",
  { cause: Schema.Unknown, message: Schema.String }
) {}

/**
 * One in-memory native project. Without libraries or module resolution a name
 * binds only to declarations in its own module, and forced module detection
 * keeps the top-level names of one file out of every other file.
 */
const ProjectConfig = Schema.fromJsonString(
  Schema.Struct({
    compilerOptions: Schema.Struct({
      jsx: Schema.Literal("preserve"),
      moduleDetection: Schema.Literal("force"),
      noLib: Schema.Literal(true),
      noResolve: Schema.Literal(true),
    }),
    files: Schema.Array(Schema.String),
  })
);

const SOURCE_ROOT = "/source-policy";
const SOURCE_CONFIG = `${SOURCE_ROOT}/tsconfig.json`;
const JSX_MODULE_PATTERN = /\.tsx$/u;
/** The declarations that bind a name to an import. */
const IMPORT_DECLARATIONS = HashSet.make(
  SyntaxKind.ImportClause,
  SyntaxKind.ImportEqualsDeclaration,
  SyntaxKind.ImportSpecifier,
  SyntaxKind.NamespaceImport
);

/** Encodes the configuration of one in-memory project over `files`. */
export function projectConfig(files: readonly string[]) {
  return Schema.encodeEffect(ProjectConfig)({
    compilerOptions: {
      jsx: "preserve",
      moduleDetection: "force",
      noLib: true,
      noResolve: true,
    },
    files,
  }).pipe(Effect.orDie);
}

/** Returns the direct children of one node, in source order. */
export function children(node: Node) {
  const nodes = MutableList.make<Node>();
  node.forEachChild((child) => {
    MutableList.append(nodes, child);
  });
  return MutableList.takeAll(nodes);
}

/** Returns value-position descendants in breadth-first order, excluding type-only subtrees. */
export function descendants(sourceFile: SourceFile, skipTypes = true) {
  const pending = MutableList.make<Node>();
  const visited = MutableList.make<Node>();
  MutableList.append(pending, sourceFile);
  for (
    let node = MutableList.take(pending);
    node !== MutableList.Empty;
    node = MutableList.take(pending)
  ) {
    MutableList.append(visited, node);
    if (!(skipTypes && isTypeNode(node))) {
      node.forEachChild((child) => {
        MutableList.append(pending, child);
      });
    }
  }
  return MutableList.takeAll(visited);
}

/** Opens one scoped native compiler over an in-memory source set. */
export function openCompiler(files: Record<string, string>, message: string) {
  return Effect.acquireRelease(
    Effect.try({
      try: () => new API({ cwd: "/", fs: createVirtualFileSystem(files) }),
      catch: (cause) => new TestCompilerError({ cause, message }),
    }),
    (resource) => Effect.sync(() => resource.close())
  );
}

/** Classifies a resolved symbol by what its identifier names. */
function binding(symbol: NativeSymbol | undefined): typeof Binding.Type {
  if (symbol === undefined || Arr.isReadonlyArrayEmpty(symbol.declarations)) {
    return "global";
  }
  return Arr.some(symbol.declarations, ({ kind }) =>
    HashSet.has(IMPORT_DECLARATIONS, kind)
  )
    ? "import"
    : "local";
}

/** Fails a source inspection with the native compiler's cause. */
function inspectionFailure(cause: unknown) {
  return new TestCompilerError({
    cause,
    message: "Unable to inspect repository sources.",
  });
}

/**
 * Parses authored TypeScript modules in one native project, so the parsing
 * cost stays flat as the repository grows. While the scope stays open, `bind`
 * resolves identifiers from any parsed module in one batched request.
 */
export const parseSources = Effect.fn("RepositoryPolicy.parseSources")(
  function* (sources: readonly (typeof RepositorySource.Type)[]) {
    const names = Arr.map(
      sources,
      ({ file }, index) =>
        `${index}.${JSX_MODULE_PATTERN.test(file) ? "tsx" : "ts"}`
    );
    const config = yield* projectConfig(names);
    const api = yield* openCompiler(
      Rec.fromEntries(
        Arr.append(
          Arr.zipWith(sources, names, ({ sourceText }, name) => [
            `${SOURCE_ROOT}/${name}`,
            sourceText,
          ]),
          [SOURCE_CONFIG, config]
        )
      ),
      "Unable to start the native source compiler."
    );
    const snapshot = yield* Effect.acquireRelease(
      Effect.try({
        try: () =>
          api.updateSnapshot({
            openProjects: [SOURCE_CONFIG],
            closeProjects: [],
          }),
        catch: inspectionFailure,
      }),
      (resource) => Effect.sync(() => resource.dispose())
    );
    const project = yield* Effect.try({
      try: () => snapshot.getProject(SOURCE_CONFIG),
      catch: inspectionFailure,
    });
    if (project === undefined) {
      return yield* inspectionFailure("The native source project is missing.");
    }
    const sourceFiles = yield* Effect.try({
      try: () =>
        Arr.map(names, (name) =>
          project.program.getSourceFile(`${SOURCE_ROOT}/${name}`)
        ),
      catch: inspectionFailure,
    });
    const modules = yield* Effect.forEach(
      Arr.zip(sources, sourceFiles),
      ([{ file }, sourceFile]) =>
        sourceFile === undefined
          ? Effect.fail(
              inspectionFailure(
                `The native compiler did not expose ${file} as a source file.`
              )
            )
          : Effect.succeed({ file, sourceFile })
    );
    const bind = Effect.fn("RepositoryPolicy.bind")(
      (identifiers: readonly Identifier[]) =>
        Effect.try({
          try: () =>
            Arr.map(project.checker.getSymbolAtLocation(identifiers), binding),
          catch: inspectionFailure,
        })
    );
    return { bind, modules };
  }
);
