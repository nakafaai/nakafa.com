import { fileURLToPath } from "node:url";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Path, type PlatformError, Schema, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";
import ts from "typescript";

const CONVEX_API_MODULE = "@repo/backend/convex/_generated/api";
const TYPESCRIPT_SOURCE = /\.(?:ts|tsx)$/u;
const TEST_SOURCE = /\.(?:test|spec)\.(?:ts|tsx)$/u;

export interface ConvexApiReference {
  readonly path: readonly string[];
  readonly sourcePath: string;
}

/** Expected failure while reading repository history for rollout validation. */
export class ConvexRolloutGitError extends Schema.TaggedError<ConvexRolloutGitError>()(
  "ConvexRolloutGitError",
  { message: Schema.String }
) {}

/** Expected failure while resolving the generated Convex API type. */
export class ConvexRolloutTypeError extends Schema.TaggedError<ConvexRolloutTypeError>()(
  "ConvexRolloutTypeError",
  { message: Schema.String }
) {}

/** A live website API reference is absent from the proposed backend. */
export class ConvexRolloutMismatch extends Schema.TaggedError<ConvexRolloutMismatch>()(
  "ConvexRolloutMismatch",
  { message: Schema.String }
) {}

function collectText(
  stream: Stream.Stream<Uint8Array, PlatformError.PlatformError>
) {
  return stream.pipe(
    Stream.decodeText(),
    Stream.runFold(
      () => "",
      (output, chunk) => output + chunk
    )
  );
}

function gitError(error: PlatformError.PlatformError) {
  return new ConvexRolloutGitError({ message: error.message });
}

const runGit = Effect.fn("ConvexRollout.runGit")(
  (
    repositoryRoot: string,
    args: readonly string[],
    acceptedExitCodes: readonly number[] = [0]
  ) =>
    Effect.scoped(
      Effect.gen(function* () {
        const command = yield* ChildProcess.make("git", args, {
          cwd: repositoryRoot,
        }).pipe(Effect.mapError(gitError));
        const [exitCode, stdout, stderr] = yield* Effect.all(
          [
            command.exitCode.pipe(Effect.mapError(gitError)),
            collectText(command.stdout).pipe(Effect.mapError(gitError)),
            collectText(command.stderr).pipe(Effect.mapError(gitError)),
          ],
          { concurrency: 3 }
        );
        if (!acceptedExitCodes.includes(exitCode)) {
          const diagnostic = stderr.trim() || stdout.trim() || "Git failed.";
          return yield* new ConvexRolloutGitError({
            message: `git ${args.join(" ")}: ${diagnostic}`,
          });
        }
        return stdout;
      })
    )
);

function importedApiNames(sourceFile: ts.SourceFile) {
  const names = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (
      !(
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier)
      ) ||
      statement.moduleSpecifier.text !== CONVEX_API_MODULE
    ) {
      continue;
    }

    const bindings = statement.importClause?.namedBindings;
    if (!(bindings && ts.isNamedImports(bindings))) {
      continue;
    }

    for (const element of bindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text;
      if (importedName === "api") {
        names.add(element.name.text);
      }
    }
  }

  return names;
}

function propertyPath(
  expression: ts.PropertyAccessExpression,
  apiNames: ReadonlySet<string>
) {
  const path: string[] = [];
  let cursor: ts.Expression = expression;

  while (ts.isPropertyAccessExpression(cursor)) {
    path.unshift(cursor.name.text);
    cursor = cursor.expression;
  }

  if (!(ts.isIdentifier(cursor) && apiNames.has(cursor.text))) {
    return;
  }

  return path;
}

/** Reads complete generated API references from one website source module. */
export function collectConvexApiReferences(
  sourcePath: string,
  sourceText: string
) {
  const sourceFile = ts.createSourceFile(
    sourcePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    sourcePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const apiNames = importedApiNames(sourceFile);
  const references = new Map<string, ConvexApiReference>();

  function visit(node: ts.Node) {
    if (ts.isPropertyAccessExpression(node)) {
      const parentOwnsLongerPath =
        ts.isPropertyAccessExpression(node.parent) &&
        node.parent.expression === node;
      if (!parentOwnsLongerPath) {
        const path = propertyPath(node, apiNames);
        if (path) {
          references.set(path.join("."), { path, sourcePath });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return [...references.values()];
}

/** Returns base website references missing from the proposed Convex API. */
export function findMissingConvexApiReferences(
  references: readonly ConvexApiReference[],
  hasReference: (path: readonly string[]) => boolean
) {
  return references.filter(({ path }) => !hasReference(path));
}

const readBaseWebsiteReferences = Effect.fn("ConvexRollout.readBaseWebsite")(
  function* (repositoryRoot: string, baseRevision: string) {
    if (!baseRevision || baseRevision.startsWith("-")) {
      return yield* new ConvexRolloutGitError({
        message: "The rollout base revision is invalid.",
      });
    }

    yield* runGit(repositoryRoot, [
      "rev-parse",
      "--verify",
      `${baseRevision}^{commit}`,
    ]);
    const grepOutput = yield* runGit(
      repositoryRoot,
      ["grep", "-l", "-F", CONVEX_API_MODULE, baseRevision, "--", "apps/www"],
      [0, 1]
    );
    const prefix = `${baseRevision}:`;
    const sourcePaths = grepOutput
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) =>
        line.startsWith(prefix) ? line.slice(prefix.length) : line
      )
      .filter(
        (sourcePath) =>
          TYPESCRIPT_SOURCE.test(sourcePath) && !TEST_SOURCE.test(sourcePath)
      );

    const references = yield* Effect.forEach(
      sourcePaths,
      (sourcePath) =>
        runGit(repositoryRoot, ["show", `${baseRevision}:${sourcePath}`]).pipe(
          Effect.map((sourceText) =>
            collectConvexApiReferences(sourcePath, sourceText)
          )
        ),
      { concurrency: 8 }
    );

    return references.flat();
  }
);

const readCurrentApi = Effect.fn("ConvexRollout.readCurrentApi")(
  (repositoryRoot: string) =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const backendRoot = path.join(repositoryRoot, "packages", "backend");
      const configPath = path.join(backendRoot, "tsconfig.json");
      const apiPath = path.join(
        backendRoot,
        "convex",
        "_generated",
        "api.d.ts"
      );

      return yield* Effect.try({
        try: () => {
          const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
          if (configFile.error) {
            throw new Error(
              ts.flattenDiagnosticMessageText(
                configFile.error.messageText,
                "\n"
              )
            );
          }
          const config = ts.parseJsonConfigFileContent(
            configFile.config,
            ts.sys,
            backendRoot
          );
          const program = ts.createProgram({
            options: config.options,
            rootNames: [apiPath],
          });
          const sourceFile = program.getSourceFile(apiPath);
          if (!sourceFile) {
            throw new Error("The generated Convex API declaration is missing.");
          }
          const checker = program.getTypeChecker();
          const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
          const apiSymbol = moduleSymbol
            ? checker
                .getExportsOfModule(moduleSymbol)
                .find((symbol) => symbol.name === "api")
            : undefined;
          if (!apiSymbol) {
            throw new Error("The generated Convex API export is missing.");
          }
          const apiType = checker.getTypeOfSymbolAtLocation(
            apiSymbol,
            sourceFile
          );

          return (segments: readonly string[]) => {
            let currentType = apiType;
            for (const segment of segments) {
              const property = currentType.getProperty(segment);
              if (!property) {
                return false;
              }
              currentType = checker.getTypeOfSymbolAtLocation(
                property,
                sourceFile
              );
            }
            return true;
          };
        },
        catch: (cause) =>
          new ConvexRolloutTypeError({
            message:
              cause instanceof Error
                ? cause.message
                : "Unable to inspect the generated Convex API.",
          }),
      });
    })
);

/** Blocks removal of a Convex function still used by the live base website. */
export const inspectConvexRollout = Effect.fn("ConvexRollout.inspect")(
  function* (repositoryRoot: string, baseRevision: string) {
    const [references, hasReference] = yield* Effect.all(
      [
        readBaseWebsiteReferences(repositoryRoot, baseRevision),
        readCurrentApi(repositoryRoot),
      ],
      { concurrency: 2 }
    );
    const missing = findMissingConvexApiReferences(references, hasReference);
    if (missing.length > 0) {
      const details = missing
        .map(({ path, sourcePath }) => `api.${path.join(".")} in ${sourcePath}`)
        .sort()
        .join("\n");
      return yield* new ConvexRolloutMismatch({
        message: `The proposed backend removes Convex functions still used by ${baseRevision}:\n${details}\nAdd the successor first, switch the website in a later release, then remove the predecessor after promotion.`,
      });
    }

    yield* Effect.log(
      `Convex rollout preserves ${references.length} base website API references.`
    );
    return references;
  }
);

if (import.meta.main) {
  const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
  NodeRuntime.runMain(
    inspectConvexRollout(repositoryRoot, process.argv[2] ?? "origin/main").pipe(
      Effect.provide(NodeServices.layer)
    )
  );
}
