import { Array as Arr, HashSet } from "effect";
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
import { children } from "#scripts/check/source";

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

/** The identifier names that a function binds as its own parameters. */
function parameterNames(node: Node) {
  return isFunctionValue(node) || isFunctionDeclaration(node)
    ? Arr.flatMap(node.parameters, (parameter) =>
        isIdentifier(parameter.name) ? [parameter.name.text] : []
      )
    : [];
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
 * Reports each Zustand `useStore(store, selector)` whose selector can answer a
 * new array or object on every read, which makes React render again without
 * end: an inline selector that builds one, and a selector a hook takes from its
 * caller and passes on bare, since no reader of the hook can see that it must
 * answer a stable value. Wrapping the selector in `useShallow` settles both,
 * and an inline selector may instead answer a module-level constant.
 */
export function inspectSelectorSource(file: string, sourceFile: SourceFile) {
  const readers = storeReaders(sourceFile);
  if (HashSet.size(readers) === 0) {
    return [];
  }
  const lineOf = (node: Node) =>
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line +
    1;
  /** Reports the selectors below one node, given the parameters of its enclosing functions. */
  const visit = (node: Node, parameters: HashSet.HashSet<string>): string[] => {
    const scope = HashSet.union(
      parameters,
      HashSet.fromIterable(parameterNames(node))
    );
    const selector =
      isCallExpression(node) &&
      isIdentifier(node.expression) &&
      HashSet.has(readers, node.expression.text)
        ? node.arguments[1]
        : undefined;
    const found =
      selector === undefined || isShallow(selector)
        ? []
        : Arr.appendAll(
            answersFresh(selector)
              ? [
                  `${file}:${lineOf(selector)}: this store selector answers a new array or object on every read, which renders React again without end: wrap it in useShallow, or answer a module-level constant (store-selector)`,
                ]
              : [],
            isIdentifier(selector) && HashSet.has(scope, selector.text)
              ? [
                  `${file}:${lineOf(selector)}: ${selector.text} comes from the hook's caller, who cannot see that it must answer a stable value: pass useShallow(${selector.text}) to useStore (store-selector)`,
                ]
              : []
          );
    return Arr.appendAll(
      found,
      Arr.flatMap(children(node), (child) => visit(child, scope))
    );
  };
  return visit(sourceFile, HashSet.empty());
}
