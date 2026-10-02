import {
  type Expression,
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

/** The one module that owns the AI Gateway client, its credentials, and routing. */
const GATEWAY_MODULE = "packages/backend/confect/gateway/";
const GATEWAY_PACKAGE = "@ai-sdk/gateway";
/** The AI SDK's main entry re-exports the gateway client. */
const SDK_MODULE = "ai";
const CLIENT_EXPORTS = new Set(["createGateway", "gateway"]);
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

/**
 * Whether an import or re-export of the AI SDK reaches its gateway client,
 * recording the default and namespace names it binds.
 */
function reachesClient(node: Node, namespaces: Set<string>) {
  if (isExportDeclaration(node)) {
    const clause = node.exportClause;
    return (
      clause === undefined ||
      !isNamedExports(clause) ||
      clause.elements.some((element) =>
        CLIENT_EXPORTS.has((element.propertyName ?? element.name).text)
      )
    );
  }
  const clause = isImportDeclaration(node) ? node.importClause : undefined;
  if (clause?.name !== undefined) {
    namespaces.add(clause.name.text);
  }
  const bindings = clause?.namedBindings;
  if (bindings !== undefined && isNamespaceImport(bindings)) {
    namespaces.add(bindings.name.text);
  }
  return (
    bindings !== undefined &&
    isNamedImports(bindings) &&
    bindings.elements.some((element) =>
      CLIENT_EXPORTS.has((element.propertyName ?? element.name).text)
    )
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

/** `providerOptions: { gateway }` in an object, or `providerOptions.gateway = ...`. */
function buildsRouting(node: Node) {
  if (
    isPropertyAssignment(node) &&
    nameText(node.name) === "providerOptions" &&
    isObjectLiteralExpression(node.initializer)
  ) {
    return node.initializer.properties.some(
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

/**
 * Reports gateway access outside confect/gateway: any @ai-sdk/gateway
 * import, the gateway client from the AI SDK, and, outside tests, call
 * options that build `providerOptions.gateway`.
 */
export function inspectGatewaySource(file: string, sourceFile: SourceFile) {
  if (file.startsWith(GATEWAY_MODULE)) {
    return [];
  }
  const violations: string[] = [];
  const namespaces = new Set<string>();
  const routes = !TEST_MODULE_PATTERN.test(file);
  const visit = (node: Node) => {
    if (isStringLiteralLikeNode(node) && namesModule(node)) {
      if (node.text === GATEWAY_PACKAGE) {
        violations.push(`${file}: ${PACKAGE_RULE}.`);
      }
      if (node.text === SDK_MODULE && reachesClient(node.parent, namespaces)) {
        violations.push(`${file}: ${CLIENT_RULE}.`);
      }
    }
    if (
      isPropertyAccessExpression(node) &&
      isIdentifier(node.expression) &&
      namespaces.has(node.expression.text) &&
      CLIENT_EXPORTS.has(node.name.text)
    ) {
      violations.push(`${file}: ${CLIENT_RULE}.`);
    }
    if (routes && buildsRouting(node)) {
      violations.push(`${file}: ${ROUTING_RULE}.`);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  return violations;
}
