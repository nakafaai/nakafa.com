import { Array as Arr } from "effect";
import {
  isComputedPropertyName,
  isFunctionLikeDeclaration,
  isIdentifier,
  isMethodDeclaration,
  isPropertyAssignment,
  isShorthandPropertyAssignment,
  isSourceFile,
  isStringLiteral,
  type Node,
  type ObjectLiteralExpression,
  type PropertyName,
} from "typescript/unstable/ast";
import { boundFunctions, isFunctionValue } from "#scripts/check/scope";
import { unwrapped } from "#scripts/check/wrapper";

/** The option that holds a handler function, of a workflow or of a Convex builder. */
const HANDLER_KEY = "handler";

/**
 * Returns the static key that a property name spells: an identifier, a string,
 * or a computed string, such as `handler`, `"handler"`, or `["handler"]`.
 */
function propertyName(name: PropertyName): string | undefined {
  if (isIdentifier(name) || isStringLiteral(name)) {
    return name.text;
  }
  return isComputedPropertyName(name) && isStringLiteral(name.expression)
    ? name.expression.text
    : undefined;
}

/**
 * Returns the functions a handler value names: the function itself when it is
 * written inline, or the function that an identifier binds where it stands.
 */
function handlerValue(handler: Node): readonly Node[] {
  const value = unwrapped(handler);
  if (isFunctionValue(value)) {
    return [value];
  }
  return isIdentifier(value) ? boundFunctions(value) : [];
}

/**
 * Returns the handler functions that one option of an options object names: a
 * method called `handler`, the value of a `handler` property, or the variable
 * that a shorthand `handler` reads.
 */
function handlerOption(option: Node): readonly Node[] {
  if (isMethodDeclaration(option)) {
    return propertyName(option.name) === HANDLER_KEY ? [option] : [];
  }
  if (isPropertyAssignment(option)) {
    return propertyName(option.name) === HANDLER_KEY
      ? handlerValue(option.initializer)
      : [];
  }
  if (isShorthandPropertyAssignment(option)) {
    return propertyName(option.name) === HANDLER_KEY
      ? handlerValue(option.name)
      : [];
  }
  return [];
}

/**
 * Returns the handler functions that an options object names through its
 * `handler` option. Other options are not handlers, whatever their values.
 */
export function handlerFunctions(
  options: ObjectLiteralExpression
): readonly Node[] {
  return Arr.flatMap(options.properties, handlerOption);
}

/**
 * Whether a node is one of the handler functions or sits inside one, at any depth.
 * A Confect workflow handler keeps its nested callbacks, because the workflow engine
 * owns every step of the handler.
 */
export function insideHandler(node: Node, handlers: readonly Node[]): boolean {
  if (Arr.some(handlers, (handler) => handler === node)) {
    return true;
  }
  return !isSourceFile(node) && insideHandler(node.parent, handlers);
}

/**
 * Returns the nearest function that encloses a node, or `undefined` at the top
 * level of a module. A callback that a handler contains is its own nearest
 * function, so a node inside it is not directly in the handler.
 */
export function enclosingFunction(node: Node): Node | undefined {
  if (isSourceFile(node)) {
    return undefined;
  }
  return isFunctionLikeDeclaration(node.parent)
    ? node.parent
    : enclosingFunction(node.parent);
}
