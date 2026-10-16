import { Array as Arr, HashSet } from "effect";
import {
  type Expression,
  isAsExpression,
  isAwaitExpression,
  isBinaryExpression,
  isCallExpression,
  isConditionalExpression,
  isIdentifier,
  isNonNullExpression,
  isParenthesizedExpression,
  isPropertyAccessExpression,
  isSatisfiesExpression,
  isStringLiteralLikeNode,
  isTemplateExpression,
  isVariableDeclaration,
  type Node,
  SyntaxKind,
} from "typescript/unstable/ast";

/** The namespace of toast copy, which the copy test measures in every locale. */
export const TOAST_NAMESPACE = "Toast";
/** The functions that bind a namespace of translated copy to a name. */
const TRANSLATORS = HashSet.make("getTranslations", "useTranslations");
/** The methods that join text into one message. */
const JOIN_METHODS = HashSet.make("concat", "join");

/** The namespace a translator call names, such as "Toast" in `useTranslations("Toast")`, awaited or not. */
function translatorNamespace(node: Node) {
  const call = isAwaitExpression(node) ? node.expression : node;
  if (
    !(
      isCallExpression(call) &&
      isIdentifier(call.expression) &&
      HashSet.has(TRANSLATORS, call.expression.text)
    )
  ) {
    return;
  }
  const [namespace] = call.arguments;
  return namespace !== undefined && isStringLiteralLikeNode(namespace)
    ? namespace.text
    : undefined;
}

/**
 * The names whose every declaration in the module is a translator of the Toast
 * namespace. A name that another declaration also binds, in another namespace or
 * to something else, is not trusted, because the module cannot tell which
 * declaration a call means.
 */
function toastTranslators(nodes: readonly Node[]) {
  const declared = Arr.flatMap(nodes, (node) =>
    isVariableDeclaration(node) &&
    isIdentifier(node.name) &&
    node.initializer !== undefined
      ? [
          {
            name: node.name.text,
            namespace: translatorNamespace(node.initializer),
          },
        ]
      : []
  );
  const others = HashSet.fromIterable(
    Arr.flatMap(declared, ({ name, namespace }) =>
      namespace === TOAST_NAMESPACE ? [] : [name]
    )
  );
  return HashSet.fromIterable(
    Arr.filter(
      Arr.flatMap(declared, ({ name, namespace }) =>
        namespace === TOAST_NAMESPACE ? [name] : []
      ),
      (name) => !HashSet.has(others, name)
    )
  );
}

/** The expression under the wrappers that do not change what a value is. */
export function unwrap(expression: Expression): Expression {
  if (
    isParenthesizedExpression(expression) ||
    isAsExpression(expression) ||
    isSatisfiesExpression(expression) ||
    isNonNullExpression(expression)
  ) {
    return unwrap(expression.expression);
  }
  return expression;
}

/**
 * Whether a piece of code is text the source writes, not a value a caller passed
 * in: literal text, a template, a concatenation, a joined list, or a method
 * called on such text. The parentheses, `as`, `satisfies`, and `!` around it do
 * not change what it is, and a condition is text when either branch is.
 */
export function writtenText(
  expression: Expression,
  literals: HashSet.HashSet<string>
): boolean {
  const value = unwrap(expression);
  if (isStringLiteralLikeNode(value) || isTemplateExpression(value)) {
    return true;
  }
  if (isIdentifier(value)) {
    return HashSet.has(literals, value.text);
  }
  if (isConditionalExpression(value)) {
    return (
      writtenText(value.whenTrue, literals) ||
      writtenText(value.whenFalse, literals)
    );
  }
  if (isBinaryExpression(value)) {
    return (
      value.operatorToken.kind === SyntaxKind.PlusToken ||
      writtenText(value.left, literals) ||
      writtenText(value.right, literals)
    );
  }
  if (isCallExpression(value) && isPropertyAccessExpression(value.expression)) {
    return (
      HashSet.has(JOIN_METHODS, value.expression.name.text) ||
      writtenText(value.expression.expression, literals)
    );
  }
  return false;
}

/** The names that the module declares with text the source writes, such as `const label = "Saved."`. */
function writtenNames(nodes: readonly Node[]) {
  return HashSet.fromIterable(
    Arr.flatMap(nodes, (node) =>
      isVariableDeclaration(node) &&
      isIdentifier(node.name) &&
      node.initializer !== undefined &&
      writtenText(node.initializer, HashSet.empty())
        ? [node.name.text]
        : []
    )
  );
}

/**
 * What a module tells the toast rules: the names that it binds to translators
 * of the Toast namespace, and the names that it gives text the source writes.
 */
export function toastContext(nodes: readonly Node[]) {
  return {
    literals: writtenNames(nodes),
    translators: toastTranslators(nodes),
  };
}

export type ToastContext = ReturnType<typeof toastContext>;
