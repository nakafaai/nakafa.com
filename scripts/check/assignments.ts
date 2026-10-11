import { Array as Arr, HashSet, Result } from "effect";
import {
  isArrayLiteralExpression,
  isBinaryExpression,
  isElementAccessExpression,
  isIdentifier,
  isObjectLiteralExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isShorthandPropertyAssignment,
  isSpreadAssignment,
  isSpreadElement,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { descendants } from "#scripts/check/source";
import { unwrapped } from "#scripts/check/wrapper";

/** The operators that give a variable a new value that can be class text. */
const ASSIGNING_OPERATORS = HashSet.make(
  SyntaxKind.EqualsToken,
  SyntaxKind.PlusEqualsToken,
  SyntaxKind.BarBarEqualsToken,
  SyntaxKind.QuestionQuestionEqualsToken,
  SyntaxKind.AmpersandAmpersandEqualsToken
);

/**
 * Returns the names an assignment target writes: the name itself, the name a
 * member such as `STYLES.card` starts from, and each name in a destructuring
 * pattern, a default and a rest element included. A key or an index is read, not
 * written.
 */
function written(target: Node): readonly Node[] {
  const node = unwrapped(target);
  if (isIdentifier(node)) {
    return [node];
  }
  if (isPropertyAccessExpression(node) || isElementAccessExpression(node)) {
    return written(node.expression);
  }
  if (isArrayLiteralExpression(node)) {
    return Arr.flatMap(node.elements, written);
  }
  if (isObjectLiteralExpression(node)) {
    return Arr.flatMap(node.properties, written);
  }
  if (isPropertyAssignment(node)) {
    return written(node.initializer);
  }
  if (isShorthandPropertyAssignment(node)) {
    return [node.name];
  }
  if (isSpreadElement(node) || isSpreadAssignment(node)) {
    return written(node.expression);
  }
  return isBinaryExpression(node) &&
    node.operatorToken.kind === SyntaxKind.EqualsToken
    ? written(node.left)
    : [];
}

/**
 * Returns what a node assigns, as each name it writes with the value it gives: an
 * assignment with one of the operators, or the default of a shorthand member in a
 * pattern, as `{ tone = "flex" }` gives `tone` the value `"flex"`. The default of
 * any other pattern element is an assignment with `=` already.
 */
function assigned(node: Node) {
  if (isBinaryExpression(node)) {
    return HashSet.has(ASSIGNING_OPERATORS, node.operatorToken.kind)
      ? Arr.map(written(node.left), (target) => ({
          target,
          value: node.right,
        }))
      : [];
  }
  if (isShorthandPropertyAssignment(node)) {
    const { objectAssignmentInitializer: value } = node;
    return value === undefined
      ? []
      : Arr.map(written(node), (target) => ({ target, value }));
  }
  return [];
}

/**
 * Returns the assignments in one module that write a name: the identifier that
 * is written, and the value it is given. A destructuring pattern gives each name
 * it writes the whole value on its right. A loop head assigns nothing. Which
 * variable the identifier names is for the compiler to say.
 */
export function assignmentsTo(sourceFile: SourceFile, name: string) {
  return Arr.filterMap(
    Arr.flatMap(descendants(sourceFile), assigned),
    ({ target, value }) =>
      isIdentifier(target) && target.text === name
        ? Result.succeed({ target, value })
        : Result.failVoid
  );
}
