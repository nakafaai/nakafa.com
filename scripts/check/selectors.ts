import { Array as Arr, HashSet, Result } from "effect";
import {
  type Expression,
  isArrayLiteralExpression,
  isAsExpression,
  isBinaryExpression,
  isBlock,
  isCallExpression,
  isConditionalExpression,
  isFunctionDeclaration,
  isIdentifier,
  isImportDeclaration,
  isNamedImports,
  isNewExpression,
  isObjectLiteralExpression,
  isParenthesizedExpression,
  isReturnStatement,
  isStringLiteral,
  type Node,
  type SourceFile,
} from "tsrs/ast";
import { isFunctionValue } from "#scripts/check/scope";
import { children, descendants } from "#scripts/check/source";

const STORE_MODULE = "zustand";
const STORE_READER = "useStore";
const SHALLOW_READER = "useShallow";

/** The names a module binds to Zustand's `useStore`, renamed or not. */
function storeReaders(sourceFile: SourceFile) {
  return HashSet.fromIterable(
    Arr.flatMap(sourceFile.statements, (statement) => {
      const bindings =
        isImportDeclaration(statement) &&
        isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === STORE_MODULE
          ? statement.importClause?.namedBindings
          : undefined;
      if (!(bindings !== undefined && isNamedImports(bindings))) {
        return [];
      }
      return Arr.flatMap(bindings.elements, (element) =>
        (element.propertyName ?? element.name).text === STORE_READER
          ? [element.name.text]
          : []
      );
    })
  );
}

/**
 * Whether an expression answers a new value on every evaluation: an object or
 * array literal, a `new` value, either branch of a choice, or the lazy fallback
 * of a call such as `Option.getOrElse(found, () => [])`.
 */
function isFresh(node: Expression | undefined): boolean {
  if (node === undefined) {
    return false;
  }
  if (isParenthesizedExpression(node) || isAsExpression(node)) {
    return isFresh(node.expression);
  }
  if (isConditionalExpression(node)) {
    return isFresh(node.whenTrue) || isFresh(node.whenFalse);
  }
  if (isBinaryExpression(node)) {
    return isFresh(node.left) || isFresh(node.right);
  }
  if (isCallExpression(node)) {
    return Arr.some(node.arguments, (argument) => answersFresh(argument));
  }
  return (
    isObjectLiteralExpression(node) ||
    isArrayLiteralExpression(node) ||
    isNewExpression(node)
  );
}

/** Whether a function answers a new value from its own body, ignoring the functions nested in it. */
function answersFresh(node: Node): boolean {
  if (!isFunctionValue(node)) {
    return false;
  }
  const { body } = node;
  if (!isBlock(body)) {
    return isFresh(body);
  }
  /** Whether a statement returns a new value outside the functions nested in it. */
  const returnsFresh = (child: Node): boolean =>
    (isReturnStatement(child) && isFresh(child.expression)) ||
    Arr.some(
      children(child),
      (nested) =>
        !(isFunctionValue(nested) || isFunctionDeclaration(nested)) &&
        returnsFresh(nested)
    );
  return returnsFresh(body);
}

/** Whether a selector argument is already compared by `useShallow(...)`. */
function isShallow(node: Expression) {
  return (
    isCallExpression(node) &&
    isIdentifier(node.expression) &&
    node.expression.text === SHALLOW_READER
  );
}

/**
 * Reports each Zustand `useStore(store, selector)` whose inline selector builds
 * a new array, object or value on every read, which makes React render again
 * without end. Wrapping the selector in `useShallow` settles it, or it answers a
 * module-level constant. A hook that hands its caller's selector on keeps
 * `useStore`'s identity check: `useShallow` there would also call two different
 * elements, dates or files equal, which have no own keys to compare, and keep
 * the first one.
 */
export function inspectSelectorSource(file: string, sourceFile: SourceFile) {
  const readers = storeReaders(sourceFile);
  if (HashSet.size(readers) === 0) {
    return [];
  }
  return Arr.filterMap(descendants(sourceFile), (node) => {
    const selector =
      isCallExpression(node) &&
      isIdentifier(node.expression) &&
      HashSet.has(readers, node.expression.text)
        ? node.arguments[1]
        : undefined;
    if (
      selector === undefined ||
      isShallow(selector) ||
      !answersFresh(selector)
    ) {
      return Result.failVoid;
    }
    const { line } = sourceFile.getLineAndCharacterOfPosition(
      selector.getStart(sourceFile)
    );
    return Result.succeed(
      `${file}:${line + 1}: this store selector answers a new array or object on every read, which renders React again without end: wrap it in useShallow, or answer a module-level constant (store-selector)`
    );
  });
}
