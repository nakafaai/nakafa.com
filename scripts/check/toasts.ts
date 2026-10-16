import { Array as Arr, HashSet } from "effect";
import {
  type CallExpression,
  type Expression,
  isAsExpression,
  isBinaryExpression,
  isCallExpression,
  isConditionalExpression,
  isIdentifier,
  isImportDeclaration,
  isNamedImports,
  isObjectLiteralExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isSatisfiesExpression,
  isShorthandPropertyAssignment,
  isSpreadElement,
  isStringLiteralLikeNode,
  isTypeReferenceNode,
  isVariableDeclaration,
  type Node,
  type ObjectLiteralExpression,
  type SourceFile,
  type TypeNode,
} from "typescript/unstable/ast";
import {
  TOAST_NAMESPACE,
  type ToastContext,
  toastContext,
  unwrap,
  writtenText,
} from "#scripts/check/copy";
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
/** The type of a copy object: a title, and a description when it has one. */
const COPY_TYPE = "ToastCopy";
/** The keys of a copy object, and of a helper's copy options. */
const COPY_KEYS = HashSet.make("title", "description");
const TEST_MODULE_PATTERN = /\.test\.tsx?$/u;

const SONNER_RULE = `import toast from ${HELPER_MODULE} instead of ${TOAST_LIBRARY}, which only the Toaster and that helper import`;
const COPY_RULE =
  'pass toast copy from a translator, such as tToast("action-error.title"), instead of literal text, a template, a concatenation, a joined list, or a spread';
const NAMESPACE_RULE = `translate toast copy with useTranslations("${TOAST_NAMESPACE}") in the same module, so that every toast message is measured in that namespace`;

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
 * Toast namespace, or a value that a caller passed in. Written text is judged
 * whatever wraps it, and a call that is not a translator of the Toast namespace
 * is judged too. Conditions and logical operators judge both of their branches.
 */
function brokenCopy(
  expression: Expression,
  context: ToastContext
): readonly string[] {
  if (isSpreadElement(expression)) {
    return [COPY_RULE];
  }
  if (writtenText(expression, context.literals)) {
    return [COPY_RULE];
  }
  const value = unwrap(expression);
  if (isConditionalExpression(value)) {
    return [
      ...brokenCopy(value.whenTrue, context),
      ...brokenCopy(value.whenFalse, context),
    ];
  }
  if (isBinaryExpression(value)) {
    return [
      ...brokenCopy(value.left, context),
      ...brokenCopy(value.right, context),
    ];
  }
  if (isCallExpression(value)) {
    return brokenCall(value, context);
  }
  return [];
}

/**
 * The copy rules a call breaks. A call is copy only when it is a translator of
 * the Toast namespace bound in this module, called with a key.
 */
function brokenCall(
  call: CallExpression,
  context: ToastContext
): readonly string[] {
  const callee = call.expression;
  return isIdentifier(callee) && HashSet.has(context.translators, callee.text)
    ? []
    : [NAMESPACE_RULE];
}

/** The text of a property name that is an identifier or a string literal. */
function propertyKey(property: ObjectLiteralExpression["properties"][number]) {
  if (
    isPropertyAssignment(property) &&
    (isIdentifier(property.name) || isStringLiteralLikeNode(property.name))
  ) {
    return property.name.text;
  }
  return isShorthandPropertyAssignment(property) && isIdentifier(property.name)
    ? property.name.text
    : undefined;
}

/** The expression a property gives: its initializer, or the variable of a shorthand. */
function propertyValue(
  property: ObjectLiteralExpression["properties"][number]
): Expression | undefined {
  if (isPropertyAssignment(property)) {
    return property.initializer;
  }
  return isShorthandPropertyAssignment(property) && isIdentifier(property.name)
    ? property.name
    : undefined;
}

/**
 * The copy rules of the options of a toast: its description, and the label of
 * its action. The other options name no copy.
 */
function brokenOptions(
  options: ObjectLiteralExpression,
  context: ToastContext
): readonly string[] {
  return Arr.flatMap(options.properties, (property) => {
    const key = propertyKey(property);
    const value = propertyValue(property);
    if (value === undefined) {
      return [];
    }
    if (key === "description") {
      return brokenCopy(value, context);
    }
    const action = unwrap(value);
    if (key === "action" && isObjectLiteralExpression(action)) {
      return brokenActionLabel(action, context);
    }
    return [];
  });
}

/** The copy rules of the label of an action: the one copy an action shows. */
function brokenActionLabel(
  action: ObjectLiteralExpression,
  context: ToastContext
): readonly string[] {
  return Arr.flatMap(action.properties, (property) => {
    const value = propertyValue(property);
    return value !== undefined && propertyKey(property) === "label"
      ? brokenCopy(value, context)
      : [];
  });
}

/** Whether an object is a copy: a title, a description, or both, and nothing else. */
function copyShaped(object: ObjectLiteralExpression) {
  return (
    object.properties.length > 0 &&
    Arr.every(object.properties, (property) => {
      const key = propertyKey(property);
      return key !== undefined && HashSet.has(COPY_KEYS, key);
    })
  );
}

/** The copy rules of a copy object's title and description. */
function brokenCopyObject(
  object: ObjectLiteralExpression,
  context: ToastContext
): readonly string[] {
  return Arr.flatMap(object.properties, (property) => {
    const value = propertyValue(property);
    return value !== undefined &&
      HashSet.has(COPY_KEYS, propertyKey(property) ?? "")
      ? brokenCopy(value, context)
      : [];
  });
}

/** The name of a type reference, such as `ToastCopy` in `: ToastCopy`. */
function typeNamed(type: TypeNode | undefined, name: string) {
  return (
    type !== undefined &&
    isTypeReferenceNode(type) &&
    isIdentifier(type.typeName) &&
    type.typeName.text === name
  );
}

/** Whether a call is one call of the toast helper, such as `toast.error(...)`, and not a dismissal. */
function isHelperCall(call: CallExpression, helpers: HashSet.HashSet<string>) {
  const callee = call.expression;
  return (
    isPropertyAccessExpression(callee) &&
    isIdentifier(callee.expression) &&
    HashSet.has(helpers, callee.expression.text) &&
    callee.name.text !== DISMISS_METHOD
  );
}

/**
 * The copy rules of one call of the toast helper: its title, and the description
 * and action label in its options.
 */
function brokenHelperCall(
  call: CallExpression,
  context: ToastContext
): readonly string[] {
  const [title, options] = call.arguments;
  const optionsValue = options === undefined ? undefined : unwrap(options);
  return [
    ...(title === undefined ? [] : brokenCopy(title, context)),
    ...(optionsValue !== undefined && isObjectLiteralExpression(optionsValue)
      ? brokenOptions(optionsValue, context)
      : []),
  ];
}

/**
 * Whether a module imports the copy type of the helper. Such a module hands
 * copy to other functions, so a copy object that it passes on is judged. A
 * module that imports nothing of the helper may pass any object with a title,
 * such as a schema annotation, so its objects are not judged.
 */
function importsCopyType(nodes: readonly Node[]) {
  return Arr.some(nodes, (node) => {
    if (
      !(
        isImportDeclaration(node) &&
        isStringLiteralLikeNode(node.moduleSpecifier) &&
        node.moduleSpecifier.text === HELPER_MODULE
      )
    ) {
      return false;
    }
    const bindings = node.importClause?.namedBindings;
    return (
      bindings !== undefined &&
      isNamedImports(bindings) &&
      Arr.some(
        bindings.elements,
        (specifier) =>
          (specifier.propertyName ?? specifier.name).text === COPY_TYPE
      )
    );
  });
}

/** The copy rules of one call: a helper call, or, in a module that handles copy, a copy object that it passes on. */
function callViolations(
  call: CallExpression,
  helpers: HashSet.HashSet<string>,
  context: ToastContext,
  copyModule: boolean
): readonly string[] {
  if (isHelperCall(call, helpers)) {
    return brokenHelperCall(call, context);
  }
  if (!copyModule) {
    return [];
  }
  return Arr.flatMap(call.arguments, (argument) => {
    const value = unwrap(argument);
    return isObjectLiteralExpression(value) && copyShaped(value)
      ? brokenCopyObject(value, context)
      : [];
  });
}

/** The copy rules of a copy object that is typed `ToastCopy`, by annotation or by `as` or `satisfies`. */
function copyTypeViolations(
  node: Node,
  context: ToastContext
): readonly string[] {
  if (isVariableDeclaration(node) && typeNamed(node.type, COPY_TYPE)) {
    const value =
      node.initializer === undefined ? undefined : unwrap(node.initializer);
    return value !== undefined && isObjectLiteralExpression(value)
      ? brokenCopyObject(value, context)
      : [];
  }
  if (
    (isAsExpression(node) || isSatisfiesExpression(node)) &&
    typeNamed(node.type, COPY_TYPE)
  ) {
    const value = unwrap(node.expression);
    return isObjectLiteralExpression(value)
      ? brokenCopyObject(value, context)
      : [];
  }
  return [];
}

/**
 * Reports the toast rules a shipped module breaks: an import of the toast
 * library outside the Toaster and the helper, and a call of the helper whose
 * title, description, or action label is not toast copy. A copy object that
 * a caller passes on, or that is typed `ToastCopy`, is judged the same way.
 * Test modules are not judged, because they never ship and may test the library
 * and the helper.
 */
export function inspectToastSource(file: string, sourceFile: SourceFile) {
  if (TEST_MODULE_PATTERN.test(file)) {
    return [];
  }
  const nodes = descendants(sourceFile, false);
  const helpers = helperNames(nodes);
  const context = toastContext(nodes);
  const library = !HashSet.has(TOAST_MODULES, file);
  const copyModule = importsCopyType(nodes);
  return Arr.map(
    Arr.flatMap(nodes, (node) => [
      ...(library &&
      isStringLiteralLikeNode(node) &&
      node.text === TOAST_LIBRARY &&
      namesModule(node)
        ? [SONNER_RULE]
        : []),
      ...(isCallExpression(node)
        ? callViolations(node, helpers, context, copyModule)
        : []),
      ...copyTypeViolations(node, context),
    ]),
    (rule) => `${file}: ${rule}.`
  );
}
