import { Array as Arr, HashSet, Match, Schema } from "effect";
import {
  type Identifier,
  isArrowFunction,
  isCallExpression,
  isExportAssignment,
  isFunctionExpression,
  isIdentifier,
  isImportDeclaration,
  isNamedImports,
  isPropertyAccessExpression,
  isSatisfiesExpression,
  isSourceFile,
  isStringLiteral,
  isTypeReferenceNode,
  type Node,
  type SourceFile,
} from "typescript/unstable/ast";
import type { Binding } from "#scripts/check/source";

/** Every Effect-native source rule, by the id each violation reports. */
export const Rule = Schema.Literals([
  "array-check",
  "object-helper",
  "try-catch",
  "typeof-object",
]);

/** The authored modules a rule inspects: every module, or code outside framework configuration. */
const RuleScope = Schema.Literals(["every", "code"]);

/** One rule's scope and the Effect-native replacement it names. */
const RuleDefinition = Schema.Struct({
  message: Schema.String,
  scope: RuleScope,
});

/** The scope and message of every rule. */
export const RULES = {
  "array-check": {
    message:
      "narrow with Array.isArray from effect, Predicate, or Schema instead of the global Array.isArray.",
    scope: "code",
  },
  "object-helper": {
    message:
      "use Record.keys, Record.values, Record.toEntries, or Record.fromEntries from effect instead of the Object helper.",
    scope: "code",
  },
  "try-catch": {
    message: "model failure with Effect instead of a raw try/catch statement.",
    scope: "every",
  },
  "typeof-object": {
    message:
      "narrow unknown input with Schema or Predicate instead of a typeof-object check.",
    scope: "every",
  },
} satisfies Record<typeof Rule.Type, typeof RuleDefinition.Type>;

const CONFIGURATION_FILE_PATTERN = /(?:^|\/)[^/]+\.config\.[cm]?tsx?$/u;
/** The Vitest configuration API, which shared configuration modules import. */
const CONFIGURATION_MODULE_PATTERN = /^vitest\/config$/u;
const PLAYWRIGHT_PATTERN = /^@playwright\/test$/u;
/** Playwright methods that serialize a function and run it in the browser page. */
const PAGE_METHODS = HashSet.make(
  "$$eval",
  "$eval",
  "addInitScript",
  "evaluate",
  "evaluateAll",
  "evaluateHandle",
  "waitForFunction"
);
const GLOBAL_ONLY: readonly (typeof Binding.Type)[] = ["global"];
/** Framework configuration types name what they configure, such as `NextConfig` or Convex's `AuthConfig`. */
const CONFIGURATION_TYPE_PATTERN = /Config$/u;
/** Relative paths, app aliases, and workspace packages name repository modules rather than framework packages. */
const LOCAL_SPECIFIER_PATTERN = /^(?:\.|@\/|@repo\/|#)/u;

/** Whether a module imports a module specifier that `pattern` matches. */
function imports(sourceFile: SourceFile, pattern: RegExp) {
  return Arr.some(
    sourceFile.statements,
    (statement) =>
      isImportDeclaration(statement) &&
      isStringLiteral(statement.moduleSpecifier) &&
      pattern.test(statement.moduleSpecifier.text)
  );
}

/** Whether a module imports `name` by a named import from a framework package. */
function importsFromPackage(sourceFile: SourceFile, name: string) {
  return Arr.some(sourceFile.statements, (statement) => {
    if (
      !(
        isImportDeclaration(statement) &&
        isStringLiteral(statement.moduleSpecifier)
      ) ||
      LOCAL_SPECIFIER_PATTERN.test(statement.moduleSpecifier.text)
    ) {
      return false;
    }
    const bindings = statement.importClause?.namedBindings;
    return (
      bindings !== undefined &&
      isNamedImports(bindings) &&
      Arr.some(bindings.elements, (element) => element.name.text === name)
    );
  });
}

/**
 * Whether the default export `satisfies` a configuration type that a framework
 * package defines, as the Confect source of `convex/auth.config.ts` does with
 * Convex's `AuthConfig`.
 */
function exportsFrameworkConfiguration(sourceFile: SourceFile) {
  return Arr.some(sourceFile.statements, (statement) => {
    if (
      !(
        isExportAssignment(statement) &&
        isSatisfiesExpression(statement.expression)
      )
    ) {
      return false;
    }
    const { type } = statement.expression;
    return (
      isTypeReferenceNode(type) &&
      isIdentifier(type.typeName) &&
      CONFIGURATION_TYPE_PATTERN.test(type.typeName.text) &&
      importsFromPackage(sourceFile, type.typeName.text)
    );
  });
}

/**
 * Whether a module configures a framework: by file name, through the Vitest
 * configuration API, or by a default export that satisfies a framework
 * package's configuration type.
 */
function isConfiguration(file: string, sourceFile: SourceFile) {
  return (
    CONFIGURATION_FILE_PATTERN.test(file) ||
    imports(sourceFile, CONFIGURATION_MODULE_PATTERN) ||
    exportsFrameworkConfiguration(sourceFile)
  );
}

/** Whether a node is a function that a Playwright call serializes into the browser page. */
function isPageFunction(node: Node) {
  if (!(isArrowFunction(node) || isFunctionExpression(node))) {
    return false;
  }
  const call = node.parent;
  return (
    isCallExpression(call) &&
    Arr.some(call.arguments, (argument) => argument === node) &&
    isPropertyAccessExpression(call.expression) &&
    HashSet.has(PAGE_METHODS, call.expression.name.text)
  );
}

/** Whether a node sits inside a function that runs in the browser page. */
function runsInPage(node: Node): boolean {
  if (isSourceFile(node)) {
    return false;
  }
  return isPageFunction(node) || runsInPage(node.parent);
}

/**
 * Returns the nodes of a module that run where its imports exist. In a
 * Playwright module, a function passed to `page.evaluate`, `addInitScript`,
 * or one of their siblings is serialized into the browser page. No import
 * exists there, so Effect cannot replace a platform global inside it.
 */
export function outsidePage(sourceFile: SourceFile, nodes: readonly Node[]) {
  return imports(sourceFile, PLAYWRIGHT_PATTERN)
    ? Arr.filter(nodes, (node) => !runsInPage(node))
    : nodes;
}

/** Whether `rule` inspects the authored module `file`. */
export function covers(
  rule: typeof Rule.Type,
  file: string,
  sourceFile: SourceFile
) {
  return Match.value(RULES[rule].scope).pipe(
    Match.when("every", () => true),
    Match.when("code", () => !isConfiguration(file, sourceFile)),
    Match.exhaustive
  );
}

/**
 * One construct that breaks `rule` at the line where `node` starts. When the
 * construct names a binding, it counts only while `reference` binds as one of
 * `accepts`, such as a platform global that no import or local shadows.
 */
export function candidate(
  rule: typeof Rule.Type,
  sourceFile: SourceFile,
  node: Node,
  reference?: Identifier,
  accepts = GLOBAL_ONLY
) {
  const { line } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile)
  );
  return { accepts, line: line + 1, reference, rule };
}
