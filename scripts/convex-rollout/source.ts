import { Effect, Schema } from "effect";
import ts from "typescript";

const CONVEX_API_MODULE = "@repo/backend/convex/_generated/api";

export interface ConvexApiReference {
  readonly path: readonly string[];
  readonly sourcePath: string;
}

type ApiPathResult =
  | { readonly path: readonly string[] }
  | { readonly problem: string };

/** Expected failure while reading a generated Convex API reference. */
export class ConvexRolloutSourceError extends Schema.TaggedError<ConvexRolloutSourceError>()(
  "ConvexRolloutSourceError",
  { message: Schema.String }
) {}

function apiImportNames(sourceFile: ts.SourceFile) {
  const names = new Set<string>();
  const problems: string[] = [];

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

    const clause = statement.importClause;
    if (!clause) {
      continue;
    }
    if (clause.name) {
      problems.push("default import");
    }

    const bindings = clause.namedBindings;
    if (!bindings) {
      continue;
    }
    if (ts.isNamespaceImport(bindings)) {
      problems.push("namespace import");
      continue;
    }

    for (const element of bindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text;
      if (importedName !== "api") {
        problems.push(`named import ${importedName}`);
        continue;
      }
      names.add(element.name.text);
    }
  }

  return { names, problems };
}

function isImportName(node: ts.Identifier) {
  return ts.isImportSpecifier(node.parent) || ts.isImportClause(node.parent);
}

function isPropertyName(node: ts.Identifier) {
  const parent = node.parent;
  return (
    (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    (ts.isPropertyAssignment(parent) && parent.name === node) ||
    (ts.isQualifiedName(parent) && parent.right === node)
  );
}

function unwrapParent(expression: ts.Node): ts.Expression | undefined {
  if (!ts.isExpression(expression)) {
    return;
  }
  const parent = expression.parent;
  if (
    (ts.isParenthesizedExpression(parent) ||
      ts.isAsExpression(parent) ||
      ts.isTypeAssertionExpression(parent) ||
      ts.isNonNullExpression(parent) ||
      ts.isSatisfiesExpression(parent)) &&
    parent.expression === expression
  ) {
    return parent;
  }
}

function apiPath(identifier: ts.Identifier): ApiPathResult {
  const path: string[] = [];
  let expression: ts.Node = identifier;

  while (true) {
    const wrapper = unwrapParent(expression);
    if (wrapper) {
      expression = wrapper;
      continue;
    }

    const parent = expression.parent;
    if (ts.isQualifiedName(parent) && parent.left === expression) {
      path.push(parent.right.text);
      expression = parent;
      continue;
    }
    if (
      ts.isPropertyAccessExpression(parent) &&
      parent.expression === expression
    ) {
      path.push(parent.name.text);
      expression = parent;
      continue;
    }
    if (
      ts.isElementAccessExpression(parent) &&
      parent.expression === expression
    ) {
      const argument = parent.argumentExpression;
      if (
        !(
          ts.isStringLiteral(argument) ||
          ts.isNoSubstitutionTemplateLiteral(argument)
        )
      ) {
        return { problem: "computed element access" };
      }
      path.push(argument.text);
      expression = parent;
      continue;
    }
    break;
  }

  if (path.length === 0) {
    return { problem: "direct or destructured API use" };
  }
  return { path };
}

/** Reads complete generated API references from one deployed source module. */
export const collectConvexApiReferences = Effect.fn(
  "ConvexRollout.collectReferences"
)(function* (sourcePath: string, sourceText: string) {
  const sourceFile = ts.createSourceFile(
    sourcePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    sourcePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const imports = apiImportNames(sourceFile);
  const problems = [...imports.problems];
  const references = new Map<string, ConvexApiReference>();

  function visit(node: ts.Node) {
    if (
      ts.isIdentifier(node) &&
      imports.names.has(node.text) &&
      !isImportName(node) &&
      !isPropertyName(node)
    ) {
      const result = apiPath(node);
      if ("problem" in result) {
        problems.push(result.problem);
      } else {
        references.set(result.path.join("."), {
          path: result.path,
          sourcePath,
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  if (problems.length > 0) {
    const detail = [...new Set(problems)].sort().join(", ");
    return yield* new ConvexRolloutSourceError({
      message: `${sourcePath} uses unsupported generated API syntax: ${detail}. Use one complete api.module.function reference.`,
    });
  }
  return [...references.values()];
});

/** Returns deployed references missing from the proposed Convex API. */
export function findMissingConvexApiReferences<
  Reference extends ConvexApiReference,
>(
  references: readonly Reference[],
  hasReference: (path: readonly string[]) => boolean
) {
  return references.filter(({ path }) => !hasReference(path));
}
