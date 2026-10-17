import { RefsSourceError } from "@repo/backend/scripts/refs/errors";
import { Array as Arr, Effect, Option, Result, Schema } from "effect";
import {
  type CallExpression,
  type Expression,
  isAsExpression,
  isCallExpression,
  isComputedPropertyName,
  isIdentifier,
  isImportDeclaration,
  isObjectLiteralExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isStringLiteral,
  isVariableStatement,
  type ObjectLiteralElementLike,
  type ObjectLiteralExpression,
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

/** A leaf and the group path that the group objects of the spec nest it at. */
const NestedLeaf = Schema.Struct({
  localName: Schema.String,
  segments: Schema.Array(Schema.String),
});

/** One leaf spec of the assembled spec, with the group path its groups give it. */
export const AssembledLeaf = Schema.Struct({
  localName: Schema.String,
  nestedSegments: Schema.Array(Schema.String),
  specifier: Schema.String,
});

/** Whether a node reads `owner.member`, such as `GroupSpec.make`. */
const isStaticMember = (node: Expression, owner: string, member: string) =>
  isPropertyAccessExpression(node) &&
  isIdentifier(node.expression) &&
  node.expression.text === owner &&
  node.name.text === member;

/**
 * Removes the `as typeof spec` that a generated spec ends with, so the call
 * under it is read.
 */
const withoutAssertion = (expression: Expression): Expression =>
  isAsExpression(expression)
    ? withoutAssertion(expression.expression)
    : expression;

/** Whether a node calls `GroupSpec.make()`, the empty base of a group. */
const isGroupBase = (node: Expression) =>
  isCallExpression(node) &&
  node.arguments.length === 0 &&
  isStaticMember(node.expression, "GroupSpec", "make");

/** Whether a node calls `Spec.fromGroups(...)`, which starts the assembled spec. */
const isSpecFactory = (node: Expression): node is CallExpression =>
  isCallExpression(node) &&
  isStaticMember(node.expression, "Spec", "fromGroups");

/** The base and the group object of a `GroupSpec.addGroupsAt(base, { ... })` call. */
const addGroupsCall = (
  expression: Expression
): Option.Option<{
  readonly base: Expression;
  readonly groups: ObjectLiteralExpression;
}> => {
  if (
    !(
      isCallExpression(expression) &&
      isStaticMember(expression.expression, "GroupSpec", "addGroupsAt") &&
      expression.arguments.length === 2
    )
  ) {
    return Option.none();
  }
  const [base, groups] = expression.arguments;
  return isObjectLiteralExpression(groups)
    ? Option.some({ base, groups })
    : Option.none();
};

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

/** Reads the name and the value of one group property, such as `["turns"]: nina_turns`. */
const groupEntry = Effect.fn("RefsAssembly.groupEntry")(function* (
  property: ObjectLiteralElementLike
) {
  if (
    isPropertyAssignment(property) &&
    isComputedPropertyName(property.name) &&
    isStringLiteral(property.name.expression)
  ) {
    return {
      initializer: property.initializer,
      name: property.name.expression.text,
    };
  }
  return yield* new RefsSourceError({
    message: "Each nested group needs a string literal name.",
  });
});

/** The error of a group expression that is neither a leaf import nor a group built on `GroupSpec.make()`. */
const unexpectedGroup = (segments: readonly string[]) =>
  new RefsSourceError({
    message: `Unexpected group expression under ${Arr.join(segments, ".")}.`,
  });

/** The leaves under one group object, nested at `segments` plus the name of each property. */
const groupsNesting = Effect.fn("RefsAssembly.groupsNesting")(function* (
  groups: ObjectLiteralExpression,
  segments: readonly string[]
): Effect.fn.Return<readonly (typeof NestedLeaf.Type)[], RefsSourceError> {
  const entries = yield* Effect.forEach(groups.properties, groupEntry);
  const nested = yield* Effect.forEach(entries, ({ initializer, name }) =>
    groupNesting(initializer, [...segments, name])
  );
  return Arr.flatten(nested);
});

/** The leaves under one group expression: a leaf import, or a group that may hold its own leaf. */
const groupNesting = Effect.fn("RefsAssembly.groupNesting")(function* (
  expression: Expression,
  segments: readonly string[]
): Effect.fn.Return<readonly (typeof NestedLeaf.Type)[], RefsSourceError> {
  if (isIdentifier(expression)) {
    return [{ localName: expression.text, segments }];
  }
  const call = addGroupsCall(expression);
  if (Option.isNone(call)) {
    return yield* unexpectedGroup(segments);
  }
  const { base, groups } = call.value;
  if (isIdentifier(base)) {
    const children = yield* groupsNesting(groups, segments);
    return [{ localName: base.text, segments }, ...children];
  }
  if (isGroupBase(base)) {
    return yield* groupsNesting(groups, segments);
  }
  return yield* unexpectedGroup(segments);
});

/** Every leaf that the `Spec.fromGroups` call nests, read from its group object. */
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
    return yield* new RefsSourceError({
      message: "The assembled spec must declare const spec.",
    });
  }
  const assembled = withoutAssertion(expression.value);
  if (!isSpecFactory(assembled)) {
    return yield* new RefsSourceError({
      message: "The assembled spec must start from Spec.fromGroups().",
    });
  }
  const [groups] = assembled.arguments;
  if (assembled.arguments.length !== 1 || !isObjectLiteralExpression(groups)) {
    return yield* new RefsSourceError({
      message: "Spec.fromGroups takes one object of groups.",
    });
  }
  return yield* groupsNesting(groups, []);
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
    return yield* new RefsSourceError({
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
 * that its group objects nest each leaf at. Every import must be nested exactly
 * once, and every nested leaf must be an import.
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
    return yield* new RefsSourceError({
      message:
        "Every nested leaf must be a default import of the assembled spec.",
    });
  }
  return yield* Effect.forEach(imports, (imported) =>
    pairLeaf(imported, nested)
  );
}, Effect.scoped);
