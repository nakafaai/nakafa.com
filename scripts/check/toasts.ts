import { Array as Arr, HashSet } from "effect";
import {
  type CallExpression,
  type Expression,
  isAwaitExpression,
  isBinaryExpression,
  isCallExpression,
  isConditionalExpression,
  isIdentifier,
  isImportDeclaration,
  isNamedImports,
  isObjectLiteralExpression,
  isParenthesizedExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isSpreadElement,
  isStringLiteralLikeNode,
  isTemplateExpression,
  isVariableDeclaration,
  type Node,
  type ObjectLiteralExpression,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { descendants, namesModule } from "#scripts/check/source";

/** The toast library, which only the Toaster and the toast helper import. */
const TOAST_LIBRARY = "sonner";
/** The Toaster and the helper that shows every toast: the only modules that import the library. */
const TOAST_MODULES = HashSet.make(
  "packages/design-system/components/ui/sonner.tsx",
  "packages/design-system/lib/toast/notify.ts"
);
/** The helper module, and the export whose methods show a toast. */
const HELPER_MODULE = "@repo/design-system/lib/toast/notify";
const HELPER_EXPORT = "toast";
/** The helper method that closes a toast: its argument is an id, not copy. */
const DISMISS_METHOD = "dismiss";
/** The namespace of toast copy, which the copy test measures in every locale. */
const TOAST_NAMESPACE = "Toast";
/** The functions that bind a namespace of translated copy to a name. */
const TRANSLATORS = HashSet.make("getTranslations", "useTranslations");
/** The methods that join text into one message. */
const JOIN_METHODS = HashSet.make("concat", "join");
const TEST_MODULE_PATTERN = /\.test\.tsx?$/u;

const SONNER_RULE = `import toast from ${HELPER_MODULE} instead of ${TOAST_LIBRARY}, which only the Toaster and that helper import`;
const COPY_RULE =
  'pass toast copy from a translator, such as tToast("action-error.title"), instead of literal text, a template, a concatenation, a joined list, or a spread';
const NAMESPACE_RULE = `translate toast copy with useTranslations("${TOAST_NAMESPACE}") in the same module, so that every toast message is measured in that namespace`;

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

/** The names that a module binds to a translator of the Toast namespace. */
function toastTranslators(nodes: readonly Node[]) {
  return HashSet.fromIterable(
    Arr.flatMap(nodes, (node) =>
      isVariableDeclaration(node) &&
      isIdentifier(node.name) &&
      node.initializer !== undefined &&
      translatorNamespace(node.initializer) === TOAST_NAMESPACE
        ? [node.name.text]
        : []
    )
  );
}

/** The names that a module imports as the toast helper's export. */
function helperNames(nodes: readonly Node[]) {
  return HashSet.fromIterable(
    Arr.flatMap(nodes, (node) => {
      if (
        !(
          isImportDeclaration(node) &&
          isStringLiteralLikeNode(node.moduleSpecifier) &&
          node.moduleSpecifier.text === HELPER_MODULE
        )
      ) {
        return [];
      }
      const bindings = node.importClause?.namedBindings;
      if (bindings === undefined || !isNamedImports(bindings)) {
        return [];
      }
      return Arr.flatMap(bindings.elements, (specifier) =>
        (specifier.propertyName ?? specifier.name).text === HELPER_EXPORT
          ? [specifier.name.text]
          : []
      );
    })
  );
}

/**
 * The copy rules a piece of copy breaks. Copy is a translator call of the
 * Toast namespace, or a value that a caller passed in. Literal text, a template,
 * a concatenation, and a joined list are not copy, so each is a violation.
 * Conditions and logical operators judge both of their branches.
 */
function brokenCopy(
  expression: Expression,
  translators: HashSet.HashSet<string>
): readonly string[] {
  if (isParenthesizedExpression(expression)) {
    return brokenCopy(expression.expression, translators);
  }
  if (isStringLiteralLikeNode(expression) || isTemplateExpression(expression)) {
    return [COPY_RULE];
  }
  if (isSpreadElement(expression)) {
    return [COPY_RULE];
  }
  if (isConditionalExpression(expression)) {
    return [
      ...brokenCopy(expression.whenTrue, translators),
      ...brokenCopy(expression.whenFalse, translators),
    ];
  }
  if (isBinaryExpression(expression)) {
    if (expression.operatorToken.kind === SyntaxKind.PlusToken) {
      return [COPY_RULE];
    }
    return [
      ...brokenCopy(expression.left, translators),
      ...brokenCopy(expression.right, translators),
    ];
  }
  if (isCallExpression(expression)) {
    return brokenCall(expression, translators);
  }
  return [];
}

/**
 * The copy rules a call breaks. A call that joins text is a joined list. A call
 * with a literal first argument is a translator call, and it must be a
 * translator of the Toast namespace bound in this module.
 */
function brokenCall(
  call: CallExpression,
  translators: HashSet.HashSet<string>
): readonly string[] {
  const callee = call.expression;
  if (
    isPropertyAccessExpression(callee) &&
    HashSet.has(JOIN_METHODS, callee.name.text)
  ) {
    return [COPY_RULE];
  }
  const [first] = call.arguments;
  if (first === undefined || !isStringLiteralLikeNode(first)) {
    return [];
  }
  return isIdentifier(callee) && HashSet.has(translators, callee.text)
    ? []
    : [NAMESPACE_RULE];
}

/** The text of a property name that is an identifier or a string literal. */
function propertyNameText(
  property: ObjectLiteralExpression["properties"][number]
) {
  return isPropertyAssignment(property) &&
    (isIdentifier(property.name) || isStringLiteralLikeNode(property.name))
    ? property.name.text
    : undefined;
}

/**
 * The copy rules of the options of a toast: its description, and the label of
 * its action. The other options name no copy.
 */
function brokenOptions(
  options: ObjectLiteralExpression,
  translators: HashSet.HashSet<string>
): readonly string[] {
  return Arr.flatMap(options.properties, (property) => {
    if (!isPropertyAssignment(property)) {
      return [];
    }
    const name = propertyNameText(property);
    if (name === "description") {
      return brokenCopy(property.initializer, translators);
    }
    if (name === "action" && isObjectLiteralExpression(property.initializer)) {
      return Arr.flatMap(property.initializer.properties, (action) =>
        propertyNameText(action) === "label" && isPropertyAssignment(action)
          ? brokenCopy(action.initializer, translators)
          : []
      );
    }
    return [];
  });
}

/**
 * The copy rules of one call of the toast helper: its title, and the
 * description and action label in its options. Closing a toast takes an id, so
 * `dismiss` is not judged.
 */
function brokenHelperCall(
  call: CallExpression,
  helpers: HashSet.HashSet<string>,
  translators: HashSet.HashSet<string>
): readonly string[] {
  const callee = call.expression;
  if (
    !(
      isPropertyAccessExpression(callee) &&
      isIdentifier(callee.expression) &&
      HashSet.has(helpers, callee.expression.text) &&
      callee.name.text !== DISMISS_METHOD
    )
  ) {
    return [];
  }
  const [title, options] = call.arguments;
  return [
    ...(title === undefined ? [] : brokenCopy(title, translators)),
    ...(options !== undefined && isObjectLiteralExpression(options)
      ? brokenOptions(options, translators)
      : []),
  ];
}

/**
 * Reports the toast rules a shipped module breaks: an import of the toast
 * library outside the Toaster and the helper, and a call of the helper whose
 * title, description, or action label is not toast copy. Test modules are not
 * judged, because they never ship and may test the library and the helper.
 */
export function inspectToastSource(file: string, sourceFile: SourceFile) {
  if (TEST_MODULE_PATTERN.test(file)) {
    return [];
  }
  const nodes = descendants(sourceFile, false);
  const helpers = helperNames(nodes);
  const translators = toastTranslators(nodes);
  const library = !HashSet.has(TOAST_MODULES, file);
  return Arr.map(
    Arr.flatMap(nodes, (node) => [
      ...(library &&
      isStringLiteralLikeNode(node) &&
      node.text === TOAST_LIBRARY &&
      namesModule(node)
        ? [SONNER_RULE]
        : []),
      ...(isCallExpression(node)
        ? brokenHelperCall(node, helpers, translators)
        : []),
    ]),
    (rule) => `${file}: ${rule}.`
  );
}
