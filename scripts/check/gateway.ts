import { Array as Arr, HashSet, Match, String as Str } from "effect";
import {
  type ExportSpecifier,
  type Expression,
  type ImportSpecifier,
  isBinaryExpression,
  isExportDeclaration,
  isIdentifier,
  isImportDeclaration,
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
import { descendants, namesModule } from "#scripts/check/source";

/** The one module that calls a model, through the Convex AI gateway provider. */
const GATEWAY_MODULE = "packages/backend/confect/gateway/";
/** The AI SDK gateway client package, which no module imports. */
const GATEWAY_CLIENT_PACKAGE = "@ai-sdk/gateway";
/** The Convex AI gateway provider, which only the Gateway service imports. */
const PROVIDER_PACKAGE = "@convex-dev/ai-sdk-provider";
/** The AI SDK's main entry re-exports its gateway client. */
const SDK_MODULE = "ai";
const CLIENT_EXPORTS = HashSet.make("createGateway", "gateway");
/** The AI SDK's decision functions, which only the Gateway service calls. */
const DECISION_EXPORTS = HashSet.make(
  "experimental_decide",
  "experimental_evaluate"
);
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

const PACKAGE_RULE = `never import ${GATEWAY_CLIENT_PACKAGE}; the Convex AI gateway provider serves every model call`;
const PROVIDER_RULE = `import ${PROVIDER_PACKAGE} only inside ${GATEWAY_MODULE}; take model handles from its Gateway service`;
const CLIENT_RULE =
  "take model handles from the Gateway service in confect/gateway instead of the AI SDK's gateway client";
const DECISION_RULE =
  "take decisions from the Gateway service in confect/gateway instead of the AI SDK's decide";
const MODEL_RULE =
  "take model handles from the Gateway service instead of a gateway model ID, which the AI SDK resolves through its default gateway";

/** Whether import or export specifiers name one of some AI SDK exports. */
function names(
  exports: HashSet.HashSet<string>,
  specifiers: readonly (ExportSpecifier | ImportSpecifier)[]
) {
  return Arr.some(specifiers, (specifier) =>
    HashSet.has(exports, (specifier.propertyName ?? specifier.name).text)
  );
}

/**
 * Whether an import or re-export of the AI SDK reaches one of some of its
 * exports. A re-export of everything, `export * from "ai"` or `export * as x
 * from "ai"`, reaches them all.
 */
function reaches(exports: HashSet.HashSet<string>, declaration: Node) {
  if (isExportDeclaration(declaration)) {
    const clause = declaration.exportClause;
    return (
      clause === undefined ||
      !isNamedExports(clause) ||
      names(exports, clause.elements)
    );
  }
  const bindings = isImportDeclaration(declaration)
    ? declaration.importClause?.namedBindings
    : undefined;
  return (
    bindings !== undefined &&
    isNamedImports(bindings) &&
    names(exports, bindings.elements)
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

/** `ai.gateway` or `ai.experimental_decide` through a default or namespace import of the AI SDK. */
function reads(
  exports: HashSet.HashSet<string>,
  node: Node,
  namespaces: HashSet.HashSet<string>
) {
  return (
    isPropertyAccessExpression(node) &&
    isIdentifier(node.expression) &&
    HashSet.has(namespaces, node.expression.text) &&
    HashSet.has(exports, node.name.text)
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
 * module the Convex provider and the AI SDK's decide may be reached from.
 */
function brokenRules(
  node: Node,
  namespaces: HashSet.HashSet<string>,
  production: boolean,
  gatewayModule: boolean
): readonly string[] {
  if (isStringLiteralLikeNode(node) && namesModule(node)) {
    return Match.value(node.text).pipe(
      Match.when(GATEWAY_CLIENT_PACKAGE, () => [PACKAGE_RULE]),
      Match.when(PROVIDER_PACKAGE, () =>
        gatewayModule ? [] : [PROVIDER_RULE]
      ),
      Match.when(SDK_MODULE, () => [
        ...(reaches(CLIENT_EXPORTS, node.parent) ? [CLIENT_RULE] : []),
        ...(!gatewayModule && reaches(DECISION_EXPORTS, node.parent)
          ? [DECISION_RULE]
          : []),
      ]),
      Match.orElse(() => [])
    );
  }
  if (reads(CLIENT_EXPORTS, node, namespaces)) {
    return [CLIENT_RULE];
  }
  if (!gatewayModule && reads(DECISION_EXPORTS, node, namespaces)) {
    return [DECISION_RULE];
  }
  return production && writesModelId(node) ? [MODEL_RULE] : [];
}

/**
 * Reports the gateway rules a module breaks: any import of the @ai-sdk/gateway
 * package, the AI SDK's gateway client, the Convex provider and the AI SDK's
 * decide outside confect/gateway, and, outside tests, a gateway model ID where
 * the AI SDK takes a model.
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
