import { Array as Arr, HashSet } from "effect";
import {
  type ExportDeclaration,
  type ImportDeclaration,
  isExportDeclaration,
  isIdentifier,
  isImportDeclaration,
  isNamedExports,
  isNamedImports,
  isNamespaceExport,
  isNamespaceImport,
  isPropertyAccessExpression,
  isStringLiteralLikeNode,
  type Node,
  type SourceFile,
} from "typescript/unstable/ast";
import { loadsImport, TEST_PATTERN } from "#scripts/check/kinds";
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

/** The namespace names that imports of the Agent package bind, such as `agent` in `import * as agent`. */
function agentNamespaces(nodes: readonly Node[]) {
  return HashSet.fromIterable(
    Arr.flatMap(nodes, (node) =>
      isImportDeclaration(node) &&
      isStringLiteralLikeNode(node.moduleSpecifier) &&
      node.moduleSpecifier.text === AGENT_PACKAGE &&
      node.importClause?.namedBindings !== undefined &&
      isNamespaceImport(node.importClause.namedBindings)
        ? [node.importClause.namedBindings.name.text]
        : []
    )
  );
}

/**
 * Whether an import, a re-export, or a `export *` of the Agent package reaches one
 * of its readers. An import that loads no value, such as `import type`, reaches
 * none.
 */
function reachesReader(declaration: ImportDeclaration | ExportDeclaration) {
  if (isExportDeclaration(declaration)) {
    const clause = declaration.exportClause;
    return (
      clause === undefined ||
      isNamespaceExport(clause) ||
      (isNamedExports(clause) &&
        Arr.some(clause.elements, (element) =>
          HashSet.has(AGENT_READS, (element.propertyName ?? element.name).text)
        ))
    );
  }
  const bindings = declaration.importClause?.namedBindings;
  return (
    loadsImport(declaration) &&
    bindings !== undefined &&
    isNamedImports(bindings) &&
    Arr.some(bindings.elements, (element) =>
      HashSet.has(AGENT_READS, (element.propertyName ?? element.name).text)
    )
  );
}

/** Whether a node names a component function that returns stored messages as they are: `messages.getMessagesByIds`. */
function readsComponentMessages(node: Node) {
  if (
    !(
      isPropertyAccessExpression(node) &&
      HashSet.has(COMPONENT_READS, node.name.text)
    )
  ) {
    return false;
  }
  const receiver = node.expression;
  return (
    (isIdentifier(receiver) && receiver.text === "messages") ||
    (isPropertyAccessExpression(receiver) && receiver.name.text === "messages")
  );
}

/**
 * The rules one node breaks: an import, a re-export, or a `export *` of an Agent
 * reader, a member of a namespace import of the Agent package that reads one, and
 * a reference to a component function that returns stored messages as they are.
 */
function brokenRules(node: Node, namespaces: HashSet.HashSet<string>) {
  if (
    isStringLiteralLikeNode(node) &&
    node.text === AGENT_PACKAGE &&
    namesModule(node) &&
    (isImportDeclaration(node.parent) || isExportDeclaration(node.parent)) &&
    reachesReader(node.parent)
  ) {
    return [AGENT_RULE];
  }
  if (
    isPropertyAccessExpression(node) &&
    isIdentifier(node.expression) &&
    HashSet.has(namespaces, node.expression.text) &&
    HashSet.has(AGENT_READS, node.name.text)
  ) {
    return [AGENT_RULE];
  }
  return readsComponentMessages(node) ? [COMPONENT_RULE] : [];
}

/**
 * Reports each read of stored Nina messages and files that a module makes
 * outside the sealed module: an import, re-export, or namespace member of the
 * Agent's readers, and a reference to a component read that returns sealed rows
 * as they are. Tests and the backend test helpers read the stored form on
 * purpose, so they are not judged.
 */
export function inspectSealedSource(file: string, sourceFile: SourceFile) {
  if (!judges(file)) {
    return [];
  }
  const nodes = descendants(sourceFile, false);
  const namespaces = agentNamespaces(nodes);
  return Arr.map(
    Arr.flatMap(nodes, (node) => brokenRules(node, namespaces)),
    (rule) => `${file}: ${rule}.`
  );
}
