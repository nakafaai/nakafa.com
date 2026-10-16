import { Array as Arr, HashSet, Option } from "effect";
import {
  type BindingElement,
  type ExportSpecifier,
  type ImportSpecifier,
  isCallExpression,
  isElementAccessExpression,
  isExportDeclaration,
  isIdentifier,
  isImportDeclaration,
  isNamedExports,
  isNamedImports,
  isNamespaceExport,
  isNamespaceImport,
  isObjectBindingPattern,
  isPropertyAccessExpression,
  isStringLiteralLikeNode,
  isVariableDeclaration,
  type Node,
  type SourceFile,
} from "typescript/unstable/ast";
import { loadsExport, loadsImport, TEST_PATTERN } from "#scripts/check/kinds";
import { descendants, namesModule } from "#scripts/check/source";

/** The Agent package, whose readers of stored rows and files only the sealed module may call. */
const AGENT_PACKAGE = "@convex-dev/agent";
/** The Agent readers that return a stored row or file as it is stored. */
const AGENT_READS = HashSet.make(
  "docsToModelMessages",
  "getFile",
  "listMessages",
  "listUIMessages"
);
/** The component reads that return a stored message as it is stored. */
const COMPONENT_READS = HashSet.make(
  "getMessagesByIds",
  "listMessagesByThreadId"
);
/** The property of a component handle, such as `components.nina`, that holds its messages. */
const MESSAGES = "messages";
const MESSAGES_PROPERTY = HashSet.make(MESSAGES);
/** The sealed module of Nina messages: its form, and every read of a stored row or file. */
const SEALED_MODULE = "packages/backend/confect/nina/sealed.ts";
const SEALED_FOLDER = "packages/backend/confect/nina/sealed/";
/** The backend test helpers, which read the stored form on purpose. */
const BACKEND_TEST_FOLDER = "packages/backend/test/";
const AGENT_RULE =
  "read Nina messages and files through the sealed module, packages/backend/confect/nina/sealed (its thread, message, and file reads open each row, and its model messages convert opened rows), instead of listMessages, listUIMessages, docsToModelMessages, or getFile from @convex-dev/agent";
const COMPONENT_RULE =
  "read the Agent component's messages through the sealed module, packages/backend/confect/nina/sealed, instead of messages.listMessagesByThreadId or messages.getMessagesByIds, which return sealed rows as they are";

/**
 * Whether the rule judges a module: every authored module, except tests, the
 * backend test helpers, and the sealed module itself (ADR 0024). A read added
 * in any module is reported, so the rule never depends on where a module sits.
 */
function judges(file: string) {
  return (
    !(file.startsWith(BACKEND_TEST_FOLDER) || TEST_PATTERN.test(file)) &&
    file !== SEALED_MODULE &&
    !file.startsWith(SEALED_FOLDER)
  );
}

/**
 * Whether a named import or a named re-export of the Agent package binds one of
 * its readers. A type-only specifier reads nothing, so it is skipped.
 */
function namesReader(elements: readonly (ExportSpecifier | ImportSpecifier)[]) {
  return Arr.some(
    elements,
    (element) =>
      !element.isTypeOnly &&
      HashSet.has(AGENT_READS, (element.propertyName ?? element.name).text)
  );
}

/**
 * Whether the module of an Agent declaration or a dynamic import reaches a reader.
 * A namespace import, an `export *`, and a named reader load one. A namespace
 * object carries every reader under any member name, so the load itself is the
 * break. A type-only declaration loads nothing, and a type-level import is not a
 * call, so neither reaches one.
 */
function reachesReader(owner: Node) {
  if (isImportDeclaration(owner)) {
    const bindings = owner.importClause?.namedBindings;
    return (
      loadsImport(owner) &&
      bindings !== undefined &&
      (isNamespaceImport(bindings) ||
        (isNamedImports(bindings) && namesReader(bindings.elements)))
    );
  }
  if (isExportDeclaration(owner)) {
    const clause = owner.exportClause;
    return (
      loadsExport(owner) &&
      (clause === undefined ||
        isNamespaceExport(clause) ||
        (isNamedExports(clause) && namesReader(clause.elements)))
    );
  }
  return isCallExpression(owner);
}

/** Whether a node names a messages object: `messages`, or the `messages` property of an object. */
function namesMessages(node: Node) {
  return (
    (isIdentifier(node) && node.text === MESSAGES) ||
    (isPropertyAccessExpression(node) && node.name.text === MESSAGES)
  );
}

/** Whether a node is a component handle, such as `components.nina`. */
function isComponentHandle(node: Node) {
  return (
    isPropertyAccessExpression(node) &&
    isIdentifier(node.expression) &&
    node.expression.text === "components"
  );
}

/** Whether a node is the messages of a component handle: `components.nina.messages`. */
function isComponentMessages(node: Node) {
  return (
    isPropertyAccessExpression(node) &&
    node.name.text === MESSAGES &&
    isComponentHandle(node.expression)
  );
}

/** Whether a node reads a component function by its property: `messages.getMessagesByIds`. */
function readsByProperty(node: Node) {
  return (
    isPropertyAccessExpression(node) &&
    HashSet.has(COMPONENT_READS, node.name.text) &&
    namesMessages(node.expression)
  );
}

/**
 * Whether a node reads a component function by an element, such as
 * `messages["getMessagesByIds"]`. A key of a component's messages that is not a
 * string literal cannot be named, so it is reported too. An index of a local
 * array named `messages` is not, because an array has no such key.
 */
function readsByElement(node: Node) {
  if (!isElementAccessExpression(node)) {
    return false;
  }
  const key = node.argumentExpression;
  return isStringLiteralLikeNode(key)
    ? namesMessages(node.expression) && HashSet.has(COMPONENT_READS, key.text)
    : isComponentMessages(node.expression);
}

/**
 * Whether one element of a binding pattern takes the rest of its object, a key
 * that `keys` holds, or a key that no check can name.
 */
function takesKey(element: BindingElement, keys: HashSet.HashSet<string>) {
  if (element.dotDotDotToken !== undefined) {
    return true;
  }
  return Option.exists(
    Option.fromNullishOr(element.propertyName ?? element.name),
    (key) =>
      !(isIdentifier(key) || isStringLiteralLikeNode(key)) ||
      HashSet.has(keys, key.text)
  );
}

/**
 * Whether a node is a destructuring of an object that `from` names, and that takes
 * a key of `keys`, the rest of the object, or a key that no check can name.
 */
function destructures(
  node: Node,
  from: (source: Node) => boolean,
  keys: HashSet.HashSet<string>
) {
  return (
    isVariableDeclaration(node) &&
    isObjectBindingPattern(node.name) &&
    node.initializer !== undefined &&
    from(node.initializer) &&
    Arr.some(node.name.elements, (element) => takesKey(element, keys))
  );
}

/**
 * Whether a node is the component's messages used as a value, which could reach a
 * read under any name. A member or an element of the messages is judged by its
 * name, and a destructuring of it by the names it takes, so neither is reported here.
 */
function takesMessagesObject(node: Node) {
  if (!isComponentMessages(node)) {
    return false;
  }
  const owner = node.parent;
  return !(
    ((isPropertyAccessExpression(owner) || isElementAccessExpression(owner)) &&
      owner.expression === node) ||
    (isVariableDeclaration(owner) && isObjectBindingPattern(owner.name))
  );
}

/**
 * Whether a node reads the Agent component's messages as they are stored: a read
 * of a function by its property or its element, a destructuring that takes one,
 * the messages taken as a value, or a destructuring of a component handle that
 * takes its messages.
 */
function readsComponentMessages(node: Node) {
  return (
    readsByProperty(node) ||
    readsByElement(node) ||
    destructures(node, namesMessages, COMPONENT_READS) ||
    takesMessagesObject(node) ||
    destructures(node, isComponentHandle, MESSAGES_PROPERTY)
  );
}

/**
 * The rules one node breaks: a load of the Agent package that reaches a reader,
 * and a read of the component's messages that returns sealed rows as they are.
 */
function brokenRules(node: Node) {
  if (
    isStringLiteralLikeNode(node) &&
    node.text === AGENT_PACKAGE &&
    namesModule(node) &&
    reachesReader(node.parent)
  ) {
    return [AGENT_RULE];
  }
  return readsComponentMessages(node) ? [COMPONENT_RULE] : [];
}

/**
 * Reports each read of stored Nina messages and files that a module makes
 * outside the sealed module: a load of the Agent package that reaches a reader,
 * and a read of the component's messages that returns sealed rows as they are.
 * Tests and the backend test helpers read the stored form on purpose, so they
 * are not judged.
 */
export function inspectSealedSource(file: string, sourceFile: SourceFile) {
  if (!judges(file)) {
    return [];
  }
  return Arr.map(
    Arr.flatMap(descendants(sourceFile, false), brokenRules),
    (rule) => `${file}: ${rule}.`
  );
}
