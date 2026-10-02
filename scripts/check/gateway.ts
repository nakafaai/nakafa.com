import { Array as Arr, HashSet, Match, String as Str } from "effect";
import {
  type ExportSpecifier,
  type Expression,
  type ImportSpecifier,
  isBinaryExpression,
  isCallExpression,
  isExportDeclaration,
  isIdentifier,
  isImportDeclaration,
  isImportTypeNode,
  isLiteralTypeNode,
  isNamedExports,
  isNamedImports,
  isNamespaceImport,
  isObjectLiteralExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isShorthandPropertyAssignment,
  isStringLiteralLikeNode,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { descendants } from "#scripts/check/source";

/** The one module that owns the AI Gateway client, its credentials, and routing. */
const GATEWAY_MODULE = "packages/backend/confect/gateway/";
const GATEWAY_PACKAGE = "@ai-sdk/gateway";
/** The AI SDK's main entry re-exports the gateway client. */
const SDK_MODULE = "ai";
const CLIENT_EXPORTS = HashSet.make("createGateway", "gateway");
const TEST_MODULE_PATTERN = /\.test\.tsx?$/u;

const PACKAGE_RULE = `import ${GATEWAY_PACKAGE} only inside ${GATEWAY_MODULE}; take model handles from its Gateway service`;
const CLIENT_RULE =
  "take model handles from the Gateway service in confect/gateway instead of the AI SDK's gateway client";
const ROUTING_RULE =
  "leave providerOptions.gateway to the Gateway service, whose routing replaces it";

/** Whether a string literal names the module of an import, a re-export, an import type, or a dynamic import. */
function namesModule(node: Node) {
  const owner = node.parent;
  return (
    isImportDeclaration(owner) ||
    isExportDeclaration(owner) ||
    (isLiteralTypeNode(owner) && isImportTypeNode(owner.parent)) ||
    (isCallExpression(owner) &&
      owner.expression.kind === SyntaxKind.ImportKeyword)
  );
}

/** Whether import or export specifiers name the AI SDK's gateway client. */
function namesClient(
  specifiers: readonly (ExportSpecifier | ImportSpecifier)[]
) {
  return Arr.some(specifiers, (specifier) =>
    HashSet.has(CLIENT_EXPORTS, (specifier.propertyName ?? specifier.name).text)
  );
}

/** Whether an import or re-export of the AI SDK reaches its gateway client. */
function reachesClient(declaration: Node) {
  if (isExportDeclaration(declaration)) {
    const clause = declaration.exportClause;
    return (
      clause === undefined ||
      !isNamedExports(clause) ||
      namesClient(clause.elements)
    );
  }
  const bindings = isImportDeclaration(declaration)
    ? declaration.importClause?.namedBindings
    : undefined;
  return (
    bindings !== undefined &&
    isNamedImports(bindings) &&
    namesClient(bindings.elements)
  );
}

/** The default and namespace names that imports of the AI SDK bind. */
function sdkNamespaces(nodes: readonly Node[]) {
  return HashSet.fromIterable(
    Arr.flatMap(nodes, (node) => {
      if (
        !(
          isImportDeclaration(node) &&
          isStringLiteralLikeNode(node.moduleSpecifier) &&
          node.moduleSpecifier.text === SDK_MODULE
        )
      ) {
        return [];
      }
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      return Arr.appendAll(
        clause?.name === undefined ? [] : [clause.name.text],
        bindings !== undefined && isNamespaceImport(bindings)
          ? [bindings.name.text]
          : []
      );
    })
  );
}

function nameText(node: Node) {
  return isIdentifier(node) || isStringLiteralLikeNode(node)
    ? node.text
    : undefined;
}

function accessedName(node: Expression) {
  return isPropertyAccessExpression(node) ? node.name.text : nameText(node);
}

/** `ai.gateway` or `ai.createGateway` through a default or namespace import of the AI SDK. */
function readsClient(node: Node, namespaces: HashSet.HashSet<string>) {
  return (
    isPropertyAccessExpression(node) &&
    isIdentifier(node.expression) &&
    HashSet.has(namespaces, node.expression.text) &&
    HashSet.has(CLIENT_EXPORTS, node.name.text)
  );
}

/** `providerOptions: { gateway }` in an object, or `providerOptions.gateway = ...`. */
function buildsRouting(node: Node) {
  if (
    isPropertyAssignment(node) &&
    nameText(node.name) === "providerOptions" &&
    isObjectLiteralExpression(node.initializer)
  ) {
    return Arr.some(
      node.initializer.properties,
      (property) =>
        (isPropertyAssignment(property) ||
          isShorthandPropertyAssignment(property)) &&
        nameText(property.name) === "gateway"
    );
  }
  return (
    isBinaryExpression(node) &&
    node.operatorToken.kind === SyntaxKind.EqualsToken &&
    isPropertyAccessExpression(node.left) &&
    node.left.name.text === "gateway" &&
    accessedName(node.left.expression) === "providerOptions"
  );
}

/** The gateway rules one node breaks; `routes` is false in tests, which keep stored provider metadata. */
function brokenRules(
  node: Node,
  namespaces: HashSet.HashSet<string>,
  routes: boolean
): readonly string[] {
  if (isStringLiteralLikeNode(node) && namesModule(node)) {
    return Match.value(node.text).pipe(
      Match.when(GATEWAY_PACKAGE, () => [PACKAGE_RULE]),
      Match.when(SDK_MODULE, () =>
        reachesClient(node.parent) ? [CLIENT_RULE] : []
      ),
      Match.orElse(() => [])
    );
  }
  if (readsClient(node, namespaces)) {
    return [CLIENT_RULE];
  }
  return routes && buildsRouting(node) ? [ROUTING_RULE] : [];
}

/**
 * Reports gateway access outside confect/gateway: any @ai-sdk/gateway
 * import, the gateway client from the AI SDK, and, outside tests, call
 * options that build `providerOptions.gateway`.
 */
export function inspectGatewaySource(file: string, sourceFile: SourceFile) {
  if (Str.startsWith(GATEWAY_MODULE)(file)) {
    return [];
  }
  const nodes = descendants(sourceFile, false);
  const namespaces = sdkNamespaces(nodes);
  const routes = !TEST_MODULE_PATTERN.test(file);
  return Arr.map(
    Arr.flatMap(nodes, (node) => brokenRules(node, namespaces, routes)),
    (rule) => `${file}: ${rule}.`
  );
}
