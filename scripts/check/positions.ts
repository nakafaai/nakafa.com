import { Array as Arr, HashSet } from "effect";
import {
  type BinaryExpression,
  type CallExpression,
  isArrayLiteralExpression,
  isBinaryExpression,
  isCallExpression,
  isComputedPropertyName,
  isConditionalExpression,
  isElementAccessExpression,
  isIdentifier,
  isJsxAttribute,
  isJsxExpression,
  isObjectLiteralExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isShorthandPropertyAssignment,
  isSpreadAssignment,
  isSpreadElement,
  isStringLiteralLikeNode,
  isTemplateExpression,
  type JsxAttribute,
  type Node,
  type PropertyName,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { CLASS_ATTRIBUTES, CLASS_FUNCTIONS } from "#scripts/check/editor";
import { descendants } from "#scripts/check/source";
import { unwrapped } from "#scripts/check/wrapper";

const ATTRIBUTES = HashSet.fromIterable(CLASS_ATTRIBUTES);
const FUNCTIONS = HashSet.fromIterable(CLASS_FUNCTIONS);
/**
 * The operators whose two operands can both be classes. An assignment is a
 * value too, as in `classes = alias ||= "flex"`: one that joins what its name
 * holds with its right side has both.
 */
const JOINING_OPERATORS = HashSet.make(
  SyntaxKind.BarBarToken,
  SyntaxKind.PlusToken,
  SyntaxKind.QuestionQuestionToken,
  SyntaxKind.BarBarEqualsToken,
  SyntaxKind.PlusEqualsToken,
  SyntaxKind.QuestionQuestionEqualsToken
);
/**
 * The operators whose value is a class only through their right side: `&&`, an
 * assignment, and the comma, whose left side is run and thrown away.
 */
const RIGHT_OPERATORS = HashSet.make(
  SyntaxKind.AmpersandAmpersandToken,
  SyntaxKind.AmpersandAmpersandEqualsToken,
  SyntaxKind.CommaToken,
  SyntaxKind.EqualsToken
);

/** Returns the operands of a binary expression that can be classes. */
function classOperands(node: BinaryExpression) {
  const { kind } = node.operatorToken;
  if (HashSet.has(RIGHT_OPERATORS, kind)) {
    return [node.right];
  }
  return HashSet.has(JOINING_OPERATORS, kind) ? [node.left, node.right] : [];
}

/** Whether a call is one of the class functions, such as `cn(...)`. */
function isClassCall(call: CallExpression) {
  const callee = unwrapped(call.expression);
  return isIdentifier(callee) && HashSet.has(FUNCTIONS, callee.text);
}

/**
 * Returns the names a call reads: the receiver of a method call, and each
 * argument that is not an object. An object passed to a call is its options,
 * such as `buttonVariants({ variant })`, so only a class function reads one as a
 * map. Text written in a call is never taken for a class, because the call
 * decides what it does with it. A class function call is a class position of
 * its own, so it holds no name here.
 */
function calledParts(call: CallExpression): readonly Node[] {
  if (isClassCall(call)) {
    return [];
  }
  const callee = unwrapped(call.expression);
  return Arr.filter(
    Arr.appendAll(
      isPropertyAccessExpression(callee) || isElementAccessExpression(callee)
        ? classParts(callee.expression)
        : [],
      Arr.flatMap(call.arguments, (argument) =>
        isObjectLiteralExpression(unwrapped(argument))
          ? []
          : classParts(argument)
      )
    ),
    isIdentifier
  );
}

/**
 * Returns the parts of an object key. A computed key holds an expression, and a
 * key written as a string is class text in a `clsx` map, which the language
 * server reads there and cannot read behind a name. A bare key is not a string,
 * so the language server does not read it written in place either.
 */
function keyParts(name: PropertyName): readonly Node[] {
  if (isComputedPropertyName(name)) {
    return classParts(name.expression);
  }
  return isStringLiteralLikeNode(name) ? [name] : [];
}

/** Returns the parts of one object member: its key, and its value, shorthand name, or spread. */
function memberParts(member: Node): readonly Node[] {
  if (isPropertyAssignment(member)) {
    return Arr.appendAll(keyParts(member.name), classParts(member.initializer));
  }
  if (isShorthandPropertyAssignment(member)) {
    return [member.name];
  }
  return isSpreadAssignment(member) ? classParts(member.expression) : [];
}

/**
 * Returns the parts a class value is made of. An identifier is the name it
 * reads, and a member chain such as `STYLES.card` reads the names it starts
 * from. A string or a template is class text written there. A branch, `||`,
 * `??`, `+`, the right side of `&&` and of a comma, the value of an
 * assignment, a template span, an array element, a spread, and an object key,
 * value, or shorthand name hold more parts. A call holds the names it reads
 * and no text, and a function holds none.
 */
export function classParts(node: Node): readonly Node[] {
  const value = unwrapped(node);
  if (isStringLiteralLikeNode(value)) {
    return [value];
  }
  if (isTemplateExpression(value)) {
    return Arr.prepend(
      Arr.flatMap(value.templateSpans, ({ expression }) =>
        classParts(expression)
      ),
      value
    );
  }
  if (isIdentifier(value)) {
    return [value];
  }
  if (isPropertyAccessExpression(value) || isElementAccessExpression(value)) {
    return Arr.filter(classParts(value.expression), isIdentifier);
  }
  if (isCallExpression(value)) {
    return calledParts(value);
  }
  if (isConditionalExpression(value)) {
    return Arr.appendAll(
      classParts(value.whenTrue),
      classParts(value.whenFalse)
    );
  }
  if (isBinaryExpression(value)) {
    return Arr.flatMap(classOperands(value), classParts);
  }
  if (isArrayLiteralExpression(value)) {
    return Arr.flatMap(value.elements, classParts);
  }
  if (isSpreadElement(value)) {
    return classParts(value.expression);
  }
  return isObjectLiteralExpression(value)
    ? Arr.flatMap(value.properties, memberParts)
    : [];
}

/** Returns the expression a class attribute holds between its braces. */
function attributeValue(attribute: JsxAttribute) {
  const { initializer, name } = attribute;
  return isIdentifier(name) &&
    HashSet.has(ATTRIBUTES, name.text) &&
    initializer !== undefined &&
    isJsxExpression(initializer) &&
    initializer.expression !== undefined
    ? [initializer.expression]
    : [];
}

/** Returns the names one module reads in its class values: class attributes and the arguments of class function calls. */
export function classReferences(sourceFile: SourceFile) {
  return Arr.filter(
    Arr.flatMap(
      Arr.flatMap(descendants(sourceFile), (node) => {
        if (isJsxAttribute(node)) {
          return attributeValue(node);
        }
        return isCallExpression(node) && isClassCall(node)
          ? node.arguments
          : [];
      }),
      classParts
    ),
    isIdentifier
  );
}
