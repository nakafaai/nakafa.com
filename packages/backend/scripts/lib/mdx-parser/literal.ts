import { Effect, Schema } from "effect";
import * as ts from "typescript";

export class LiteralParseError extends Schema.TaggedError<LiteralParseError>()(
  "LiteralParseError",
  { message: Schema.String }
) {}

/** Parses a trusted TypeScript literal without executing code. */
export const parseTypeScriptLiteral = Effect.fn("mdx.parseTypeScriptLiteral")(
  function* (source: string) {
    const expression = getLiteralExpression(source);

    if (!expression) {
      return yield* Effect.fail(
        new LiteralParseError({ message: "No literal expression found." })
      );
    }

    return yield* readExpression(expression);
  }
);

/** Extracts the initializer expression from a synthetic TypeScript source. */
function getLiteralExpression(source: string) {
  const sourceFile = ts.createSourceFile(
    "literal.ts",
    `const value = ${source};`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const statement = sourceFile.statements[0];

  if (!ts.isVariableStatement(statement)) {
    return null;
  }

  return statement.declarationList.declarations[0]?.initializer ?? null;
}

/** Reads a TypeScript expression that is allowed in content literals. */
function readExpression(
  expression: ts.Expression
): Effect.Effect<unknown, LiteralParseError> {
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression)
  ) {
    return Effect.succeed(expression.text);
  }

  if (ts.isNumericLiteral(expression)) {
    return Effect.succeed(Number(expression.text));
  }

  if (expression.kind === ts.SyntaxKind.TrueKeyword) {
    return Effect.succeed(true);
  }

  if (expression.kind === ts.SyntaxKind.FalseKeyword) {
    return Effect.succeed(false);
  }

  if (expression.kind === ts.SyntaxKind.NullKeyword) {
    return Effect.succeed(null);
  }

  if (ts.isPrefixUnaryExpression(expression)) {
    return readPrefixUnaryExpression(expression);
  }

  if (ts.isArrayLiteralExpression(expression)) {
    return readArrayLiteral(expression);
  }

  if (ts.isObjectLiteralExpression(expression)) {
    return readObjectLiteral(expression);
  }

  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    return readExpression(expression.expression);
  }

  return Effect.fail(
    new LiteralParseError({
      message: `Unsupported literal syntax: ${ts.SyntaxKind[expression.kind]}.`,
    })
  );
}

/** Reads a signed numeric literal. */
function readPrefixUnaryExpression(expression: ts.PrefixUnaryExpression) {
  if (!ts.isNumericLiteral(expression.operand)) {
    return Effect.fail(
      new LiteralParseError({
        message: "Only numeric unary literals are supported.",
      })
    );
  }

  const value = Number(expression.operand.text);

  if (expression.operator === ts.SyntaxKind.MinusToken) {
    return Effect.succeed(-value);
  }

  if (expression.operator === ts.SyntaxKind.PlusToken) {
    return Effect.succeed(value);
  }

  return Effect.fail(
    new LiteralParseError({ message: "Unsupported unary literal operator." })
  );
}

/** Reads an array literal recursively. */
function readArrayLiteral(expression: ts.ArrayLiteralExpression) {
  return Effect.forEach(expression.elements, readExpression);
}

/** Reads an object literal recursively. */
function readObjectLiteral(expression: ts.ObjectLiteralExpression) {
  return Effect.reduce(expression.properties, {}, (result, property) =>
    Effect.gen(function* () {
      if (!ts.isPropertyAssignment(property)) {
        return yield* Effect.fail(
          new LiteralParseError({
            message: "Only explicit object property assignments are supported.",
          })
        );
      }

      const key = yield* readPropertyName(property.name);
      const value = yield* readExpression(property.initializer);

      return { ...result, [key]: value };
    })
  );
}

/** Reads a static object property name. */
function readPropertyName(name: ts.PropertyName) {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return Effect.succeed(name.text);
  }

  return Effect.fail(
    new LiteralParseError({
      message: "Only static object property names are supported.",
    })
  );
}
