import { Effect, Schema } from "effect";
import {
  isTypeNode,
  type Node,
  type SourceFile,
} from "typescript/unstable/ast";
import { createVirtualFileSystem } from "typescript/unstable/fs";
import { API } from "typescript/unstable/sync";

/** One authored repository module and its text. */
export const RepositorySource = Schema.Struct({
  file: Schema.String,
  sourceText: Schema.String,
});

/** The native compiler could not inspect repository sources. */
export class TestCompilerError extends Schema.TaggedError<TestCompilerError>()(
  "TestCompilerError",
  { cause: Schema.Unknown, message: Schema.String }
) {}

/** Reports one policy's violations for one parsed authored module. */
export type SourceInspector = (
  file: string,
  sourceFile: SourceFile
) => readonly string[];

const SOURCE_MODULE_PATTERN = /\.tsx?$/u;

/** Returns value-position descendants while excluding type-only subtrees. */
export function descendants(sourceFile: SourceFile, skipTypes = true) {
  const nodes: Node[] = [sourceFile];
  for (const node of nodes) {
    if (skipTypes && isTypeNode(node)) {
      continue;
    }
    node.forEachChild((child) => {
      nodes.push(child);
    });
  }
  return nodes;
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

/**
 * Applies every source policy to the authored modules through one batch
 * project, so the parsing cost stays flat as the repository grows.
 */
export const sourceViolations = Effect.fn("RepositoryPolicy.sources")(
  function* (
    sources: readonly (typeof RepositorySource.Type)[],
    inspectors: readonly SourceInspector[]
  ) {
    const inspected = sources.filter(({ file }) =>
      SOURCE_MODULE_PATTERN.test(file)
    );
    if (inspected.length === 0) {
      return [];
    }
    const root = "/source-policy";
    const configFile = `${root}/tsconfig.json`;
    const modules = inspected.map(
      ({ file }, index) => `${index}.${file.endsWith(".tsx") ? "tsx" : "ts"}`
    );
    const api = yield* openCompiler(
      Object.fromEntries([
        ...inspected.map(({ sourceText }, index) => [
          `${root}/${modules[index]}`,
          sourceText,
        ]),
        [
          configFile,
          JSON.stringify({
            compilerOptions: {
              jsx: "preserve",
              noLib: true,
              noResolve: true,
            },
            files: modules,
          }),
        ],
      ]),
      "Unable to start the native source compiler."
    );
    const snapshotFailure = (cause: unknown) =>
      new TestCompilerError({
        cause,
        message: "Unable to inspect repository sources.",
      });
    const snapshot = yield* Effect.acquireRelease(
      Effect.try({
        try: () =>
          api.updateSnapshot({
            openProjects: [configFile],
            closeProjects: [],
          }),
        catch: snapshotFailure,
      }),
      (resource) => Effect.sync(() => resource.dispose())
    );
    const program = snapshot.getProject(configFile)?.program;
    if (program === undefined) {
      return yield* new TestCompilerError({
        cause: "The native source project is missing.",
        message: "Unable to inspect repository sources.",
      });
    }
    return inspected.flatMap(({ file }, index) => {
      const sourceFile = program.getSourceFile(`${root}/${modules[index]}`);
      return sourceFile === undefined
        ? [`${file}: the native compiler did not expose this source file.`]
        : inspectors.flatMap((inspect) => inspect(file, sourceFile));
    });
  },
  Effect.scoped
);
