import { RefsSourceError } from "@repo/backend/scripts/refs/errors";
import { Array as Arr, Effect, Option, Result, Schema } from "effect";
import {
  type CallExpression,
  type Expression,
  isCallExpression,
  isIdentifier,
  isImportDeclaration,
  isPropertyAccessExpression,
  isStringLiteral,
  isVariableStatement,
  type PropertyAccessExpression,
  type SourceFile,
} from "typescript/unstable/ast";
import { createVirtualFileSystem } from "typescript/unstable/fs";
import { API } from "typescript/unstable/sync";

const SOURCE_ROOT = "/refs-assembly";
const SPEC_FILE = `${SOURCE_ROOT}/spec.ts`;
const PROJECT_FILE = `${SOURCE_ROOT}/tsconfig.json`;

const ProjectConfig = Schema.fromJsonString(
  Schema.Struct({
    compilerOptions: Schema.Struct({
      moduleDetection: Schema.Literal("force"),
      noLib: Schema.Literal(true),
      noResolve: Schema.Literal(true),
    }),
    files: Schema.Array(Schema.String),
  })
);

/** A default import of the assembled spec: one leaf spec and the name it is bound to. */
const LeafImport = Schema.Struct({
  localName: Schema.String,
  specifier: Schema.String,
});

/** A leaf and the group path that the `addAt` and `addGroupAt` calls nest it at. */
const NestedLeaf = Schema.Struct({
  localName: Schema.String,
  segments: Schema.Array(Schema.String),
});

/** One leaf spec of the assembled spec, with the group path its calls give it. */
export const AssembledLeaf = Schema.Struct({
  localName: Schema.String,
  nestedSegments: Schema.Array(Schema.String),
  specifier: Schema.String,
});

/** The arguments of one call in a method chain. */
type CallArguments = readonly Expression[];

/** Whether a node is a call of the method `method`, such as `chain.addAt(...)`. */
const isMethodCall = (
  node: Expression,
  method: string
): node is CallExpression & { readonly expression: PropertyAccessExpression } =>
  isCallExpression(node) &&
  isPropertyAccessExpression(node.expression) &&
  node.expression.name.text === method;

/**
 * Unwinds a method chain such as `base.method(a).method(b)` into its base and
 * its calls, in source order.
 */
const unwindChain = (
  expression: Expression,
  method: string,
  calls: readonly CallArguments[] = []
): readonly [Expression, readonly CallArguments[]] =>
  isMethodCall(expression, method)
    ? unwindChain(expression.expression.expression, method, [
        expression.arguments,
        ...calls,
      ])
    : [expression, calls];

/** Whether a node reads `owner.member`, such as `GroupSpec.makeAt`. */
const isStaticMember = (node: Expression, owner: string, member: string) =>
  isPropertyAccessExpression(node) &&
  isIdentifier(node.expression) &&
  node.expression.text === owner &&
  node.name.text === member;

/** Whether a node calls `GroupSpec.makeAt`. */
const isGroupFactory = (node: Expression) =>
  isCallExpression(node) &&
  isStaticMember(node.expression, "GroupSpec", "makeAt");

/** Whether a node is the `Spec.make()` call that starts the assembled chain. */
const isSpecFactory = (node: Expression) =>
  isCallExpression(node) &&
  node.arguments.length === 0 &&
  isStaticMember(node.expression, "Spec", "make");

/** Opens the spec source in one in-memory native project for the enclosing scope. */
const openSourceFile = Effect.fn("RefsAssembly.openSourceFile")(function* (
  sourceText: string
) {
  const config = yield* Schema.encodeEffect(ProjectConfig)({
    compilerOptions: {
      moduleDetection: "force",
      noLib: true,
      noResolve: true,
    },
    files: [SPEC_FILE],
  }).pipe(Effect.orDie);
  const api = yield* Effect.acquireRelease(
    Effect.sync(
      () =>
        new API({
          cwd: "/",
          fs: createVirtualFileSystem({
            [SPEC_FILE]: sourceText,
            [PROJECT_FILE]: config,
          }),
        })
    ),
    (api) => Effect.sync(() => api.close())
  );
  const snapshot = yield* Effect.acquireRelease(
    Effect.sync(() =>
      api.updateSnapshot({ openProjects: [PROJECT_FILE], closeProjects: [] })
    ),
    (snapshot) => Effect.sync(() => snapshot.dispose())
  );
  const project = yield* Effect.fromNullishOr(
    snapshot.getProject(PROJECT_FILE)
  ).pipe(Effect.orDie);
  return yield* Effect.fromNullishOr(
    project.program.getSourceFile(SPEC_FILE)
  ).pipe(Effect.orDie);
});

/** The default imports of the spec: each leaf spec under the name it is bound to. */
const leafImports = (sourceFile: SourceFile) =>
  Arr.filterMap(sourceFile.statements, (statement) => {
    if (
      !(
        isImportDeclaration(statement) &&
        isStringLiteral(statement.moduleSpecifier)
      )
    ) {
      return Result.failVoid;
    }
    const name = statement.importClause?.name;
    return name === undefined
      ? Result.failVoid
      : Result.succeed({
          localName: name.text,
          specifier: statement.moduleSpecifier.text,
        });
  });

/** A group name must be a string literal, such as `"turns"`. */
const groupName = Effect.fn("RefsAssembly.groupName")(function* (
  expression: Expression
) {
  if (!isStringLiteral(expression)) {
    return yield* RefsSourceError.make({
      message: "Each nested group needs a string literal name.",
    });
  }
  return expression.text;
});

/** The name and the group argument of an `addAt` or `addGroupAt` call. */
const nameAndGroup = Effect.fn("RefsAssembly.nameAndGroup")(function* (
  args: CallArguments,
  method: string
) {
  if (args.length !== 2) {
    return yield* RefsSourceError.make({
      message: `${method} takes a name and a group.`,
    });
  }
  const [name, group] = args;
  return { group, name };
});

/** The leaves nested under one group expression, at the group path `segments`. */
const groupNesting = Effect.fn("RefsAssembly.groupNesting")(function* (
  expression: Expression,
  segments: readonly string[]
): Effect.fn.Return<readonly (typeof NestedLeaf.Type)[], RefsSourceError> {
  const [base, calls] = unwindChain(expression, "addGroupAt");
  if (!(isIdentifier(base) || isGroupFactory(base))) {
    return yield* RefsSourceError.make({
      message: `Unexpected group expression under ${Arr.join(segments, ".")}.`,
    });
  }
  const own = isIdentifier(base) ? [{ localName: base.text, segments }] : [];
  const children = yield* Effect.forEach(calls, (args) =>
    nestedCall(args, "addGroupAt", segments)
  );
  return [...own, ...Arr.flatten(children)];
});

/** The leaves under one `addAt` or `addGroupAt` call, nested at `segments` plus the call's name. */
const nestedCall = Effect.fn("RefsAssembly.nestedCall")(function* (
  args: CallArguments,
  method: string,
  segments: readonly string[]
): Effect.fn.Return<readonly (typeof NestedLeaf.Type)[], RefsSourceError> {
  const { group, name } = yield* nameAndGroup(args, method);
  const segment = yield* groupName(name);
  return yield* groupNesting(group, [...segments, segment]);
});

/** Every leaf that the `Spec.make()` chain nests, read from its `addAt` calls. */
const specNesting = Effect.fn("RefsAssembly.specNesting")(function* (
  sourceFile: SourceFile
): Effect.fn.Return<readonly (typeof NestedLeaf.Type)[], RefsSourceError> {
  const declaration = Arr.findFirst(
    Arr.flatMap(sourceFile.statements, (statement) =>
      isVariableStatement(statement)
        ? statement.declarationList.declarations
        : []
    ),
    (candidate) =>
      isIdentifier(candidate.name) && candidate.name.text === "spec"
  );
  const expression = Option.flatMap(declaration, (value) =>
    Option.fromNullishOr(value.initializer)
  );
  if (Option.isNone(expression)) {
    return yield* RefsSourceError.make({
      message: "The assembled spec must declare const spec.",
    });
  }
  const [base, calls] = unwindChain(expression.value, "addAt");
  if (!isSpecFactory(base)) {
    return yield* RefsSourceError.make({
      message: "The assembled spec must start from Spec.make().",
    });
  }
  const nested = yield* Effect.forEach(calls, (args) =>
    nestedCall(args, "addAt", [])
  );
  return Arr.flatten(nested);
});

/** Pairs one default import with its single nesting in the spec. */
const pairLeaf = Effect.fn("RefsAssembly.pairLeaf")(function* (
  imported: typeof LeafImport.Type,
  nested: readonly (typeof NestedLeaf.Type)[]
) {
  const occurrences = Arr.filter(
    nested,
    (leaf) => leaf.localName === imported.localName
  );
  if (occurrences.length !== 1) {
    return yield* RefsSourceError.make({
      message: `${imported.specifier} must be nested exactly once in the assembled spec.`,
    });
  }
  const [only] = occurrences;
  return {
    localName: imported.localName,
    nestedSegments: only.segments,
    specifier: imported.specifier,
  };
});

/**
 * Reads the default leaf imports of an assembled spec source, and the group path
 * that its `addAt` and `addGroupAt` calls nest each leaf at. Every import must be
 * nested exactly once, and every nested leaf must be an import.
 */
export const readAssembly = Effect.fn("RefsAssembly.readAssembly")(function* (
  sourceText: string
) {
  const sourceFile = yield* openSourceFile(sourceText);
  const imports = leafImports(sourceFile);
  const nested = yield* specNesting(sourceFile);
  if (
    !Arr.every(nested, (leaf) =>
      Arr.some(imports, (imported) => imported.localName === leaf.localName)
    )
  ) {
    return yield* RefsSourceError.make({
      message:
        "Every nested leaf must be a default import of the assembled spec.",
    });
  }
  return yield* Effect.forEach(imports, (imported) =>
    pairLeaf(imported, nested)
  );
}, Effect.scoped);
