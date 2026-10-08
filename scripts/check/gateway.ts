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
  isPropertyAccessExpression,
  isPropertyAssignment,
  isStringLiteralLikeNode,
  isTemplateExpression,
  isVariableDeclaration,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { descendants } from "#scripts/check/source";

/** The one module that calls a model, through the Convex AI gateway provider. */
const GATEWAY_MODULE = "packages/backend/confect/gateway/";
/** The Vercel AI Gateway client package, which no module imports. */
const VERCEL_PACKAGE = "@ai-sdk/gateway";
/** The Convex AI gateway provider, which only the Gateway service imports. */
const PROVIDER_PACKAGE = "@convex-dev/ai-sdk-provider";
/** The AI SDK's main entry re-exports its gateway client. */
const SDK_MODULE = "ai";
const CLIENT_EXPORTS = HashSet.make("createGateway", "gateway");
/** Where the AI SDK and Agent take a model, which they resolve from a string through the default gateway. */
const MODEL_PROPERTIES = HashSet.make(
  "model",
  "languageModel",
  "embeddingModel",
  "textEmbeddingModel"
);
/** Every gateway model ID names its creator first, as in `google/gemini-3.7-flash`. */
const MODEL_ID_SEPARATOR = "/";
const TEST_MODULE_PATTERN = /\.test\.tsx?$/u;

const PACKAGE_RULE = `never import ${VERCEL_PACKAGE}; the Convex AI gateway provider serves every model call`;
const PROVIDER_RULE = `import ${PROVIDER_PACKAGE} only inside ${GATEWAY_MODULE}; take model handles from its Gateway service`;
const CLIENT_RULE =
  "take model handles from the Gateway service in confect/gateway instead of the AI SDK's gateway client";
const MODEL_RULE =
  "take model handles from the Gateway service instead of a gateway model ID, which the AI SDK resolves through its default Vercel gateway";

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

/** The name a node writes or reads: `name`, `"name"`, or `x.name`. */
function accessedName(node: Node) {
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

/** A string, or a template's literal text, in the `creator/model` form of a gateway model ID. */
function namesGatewayModel(value: Expression) {
  const separates = Str.includes(MODEL_ID_SEPARATOR);
  if (isStringLiteralLikeNode(value)) {
    return separates(value.text);
  }
  return (
    isTemplateExpression(value) &&
    (separates(value.head.text) ||
      Arr.some(value.templateSpans, (span) => separates(span.literal.text)))
  );
}

/** A gateway model ID written where the AI SDK or Agent takes a model. */
function passesModelId(target: Node, value: Expression) {
  const name = accessedName(target);
  return (
    name !== undefined &&
    HashSet.has(MODEL_PROPERTIES, name) &&
    namesGatewayModel(value)
  );
}

/** Whether a property assignment, a variable declaration, or an `=` assignment writes a gateway model ID to a model property. */
function writesModelId(node: Node) {
  if (
    (isPropertyAssignment(node) || isVariableDeclaration(node)) &&
    node.initializer !== undefined
  ) {
    return passesModelId(node.name, node.initializer);
  }
  return (
    isBinaryExpression(node) &&
    node.operatorToken.kind === SyntaxKind.EqualsToken &&
    passesModelId(node.left, node.right)
  );
}

/**
 * The gateway rules one node breaks. `production` is false in tests, which keep
 * recorded model IDs; `gatewayModule` is true inside confect/gateway, the only
 * module the Convex provider may be imported from.
 */
function brokenRules(
  node: Node,
  namespaces: HashSet.HashSet<string>,
  production: boolean,
  gatewayModule: boolean
): readonly string[] {
  if (isStringLiteralLikeNode(node) && namesModule(node)) {
    return Match.value(node.text).pipe(
      Match.when(VERCEL_PACKAGE, () => [PACKAGE_RULE]),
      Match.when(PROVIDER_PACKAGE, () =>
        gatewayModule ? [] : [PROVIDER_RULE]
      ),
      Match.when(SDK_MODULE, () =>
        reachesClient(node.parent) ? [CLIENT_RULE] : []
      ),
      Match.orElse(() => [])
    );
  }
  if (readsClient(node, namespaces)) {
    return [CLIENT_RULE];
  }
  return production && writesModelId(node) ? [MODEL_RULE] : [];
}

/**
 * Reports the gateway rules a module breaks: any import of the Vercel gateway
 * package, the AI SDK's gateway client, the Convex provider outside
 * confect/gateway, and, outside tests, a gateway model ID where the AI SDK
 * takes a model.
 */
export function inspectGatewaySource(file: string, sourceFile: SourceFile) {
  const nodes = descendants(sourceFile, false);
  const namespaces = sdkNamespaces(nodes);
  const production = !TEST_MODULE_PATTERN.test(file);
  const gatewayModule = Str.startsWith(GATEWAY_MODULE)(file);
  return Arr.map(
    Arr.flatMap(nodes, (node) =>
      brokenRules(node, namespaces, production, gatewayModule)
    ),
    (rule) => `${file}: ${rule}.`
  );
}
