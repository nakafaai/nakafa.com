import { Array as Arr, HashSet, Match, Result, Schema } from "effect";
import {
  type Identifier,
  isArrowFunction,
  isCallExpression,
  isExportAssignment,
  isFunctionDeclaration,
  isFunctionExpression,
  isIdentifier,
  isImportDeclaration,
  isNamedImports,
  isPropertyAccessExpression,
  isSatisfiesExpression,
  isSourceFile,
  isStringLiteral,
  isTypeReferenceNode,
  isVariableDeclaration,
  type Node,
  type SourceFile,
} from "typescript/unstable/ast";
import type { Binding } from "#scripts/check/source";

/** Every Effect-native source rule, by the id each violation reports. */
export const Rule = Schema.Literals([
  "array-check",
  "array-method",
  "array-mutation",
  "array-search",
  "object-helper",
  "try-catch",
  "typeof-object",
]);

/**
 * The authored modules a rule inspects: every module, code outside framework
 * configuration, or the strict Confect and script modules.
 */
const RuleScope = Schema.Literals(["every", "code", "strict"]);

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
  "array-method": {
    message:
      "transform arrays with the Array module from effect, such as Array.map, Array.filter, and Array.join, instead of a native array method.",
    scope: "strict",
  },
  "array-mutation": {
    message:
      "build a new array with the Array module from effect, such as Array.append, Array.sort, and Array.reverse, or collect into a MutableList, instead of changing an array in place.",
    scope: "strict",
  },
  "array-search": {
    message:
      "search arrays with Array.findFirst, Array.findLast, or their index forms from effect, which return an Option, instead of a native find method.",
    scope: "strict",
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
const MODULE_EXTENSION_PATTERN = /\.[cm]?tsx?$/u;
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
const STRICT_PATTERN = /^(?:packages\/backend\/confect|scripts)\//u;
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

/**
 * Returns the function a Playwright call serializes into the browser page: the
 * first argument of `evaluate` and its siblings, the second of `$eval` and
 * `$$eval`.
 */
function pageArgument(node: Node) {
  if (
    !(
      isCallExpression(node) &&
      isPropertyAccessExpression(node.expression) &&
      HashSet.has(PAGE_METHODS, node.expression.name.text)
    )
  ) {
    return;
  }
  return node.arguments[node.expression.name.text.startsWith("$") ? 1 : 0];
}

/** Names one function by the module that declares it, such as `apps/www/e2e/support/canvas#countCanvasFrames`. */
function functionKey(module: string, name: string) {
  return `${module}#${name}`;
}

/** Returns a module's path without its extension, the form an import specifier resolves to. */
function moduleKey(file: string) {
  return file.replace(MODULE_EXTENSION_PATTERN, "");
}

/** Joins path segments, resolving `.` and `..`. */
function joinSegments(segments: readonly string[]) {
  return Arr.join(
    Arr.reduce(segments, Arr.empty<string>(), (path, segment) => {
      if (segment === "." || segment === "") {
        return path;
      }
      return segment === ".."
        ? Arr.dropRight(path, 1)
        : Arr.append(path, segment);
    }),
    "/"
  );
}

/**
 * Resolves a repository import specifier from `file` to a module key: the app
 * alias `@/` from the app's root (its first two path segments), and a relative
 * path from the file's folder.
 * A package specifier names no repository module.
 */
function resolveSpecifier(file: string, specifier: string) {
  if (specifier.startsWith("@/")) {
    return Result.succeed(
      joinSegments([...Arr.take(file.split("/"), 2), specifier.slice(2)])
    );
  }
  return specifier.startsWith(".")
    ? Result.succeed(
        joinSegments([
          ...Arr.dropRight(file.split("/"), 1),
          ...specifier.split("/"),
        ])
      )
    : Result.failVoid;
}

/**
 * Returns the function a local name stands for: the module that declares it
 * and its declared name. A named import resolves to the exporting module and
 * the exported name, so an aliased import still names the original function.
 */
function declaredFunction(file: string, sourceFile: SourceFile, local: string) {
  for (const statement of sourceFile.statements) {
    if (
      !(
        isImportDeclaration(statement) &&
        isStringLiteral(statement.moduleSpecifier)
      )
    ) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (bindings === undefined || !isNamedImports(bindings)) {
      continue;
    }
    const element = Arr.findFirst(
      bindings.elements,
      (candidate) => candidate.name.text === local
    );
    if (element._tag === "Some") {
      const name = element.value.propertyName?.text ?? local;
      return Result.map(
        resolveSpecifier(file, statement.moduleSpecifier.text),
        (module) => functionKey(module, name)
      );
    }
  }
  return Result.succeed(functionKey(moduleKey(file), local));
}

/**
 * Returns the functions a Playwright module passes to the browser page by
 * reference, such as `page.addInitScript(countCanvasFrames)`, each named by
 * the module that declares it.
 */
export function pageFunctionKeys(
  file: string,
  sourceFile: SourceFile,
  nodes: readonly Node[]
) {
  return imports(sourceFile, PLAYWRIGHT_PATTERN)
    ? Arr.filterMap(nodes, (node) => {
        const argument = pageArgument(node);
        return argument !== undefined && isIdentifier(argument)
          ? declaredFunction(file, sourceFile, argument.text)
          : Result.failVoid;
      })
    : [];
}

/**
 * Whether a node is a function that runs in the browser page: one written in
 * a Playwright call of a Playwright module, or one this module declares under
 * a name that satisfies `passed`.
 */
function isPageFunction(
  node: Node,
  inline: boolean,
  passed: (name: string) => boolean
) {
  if (isFunctionDeclaration(node)) {
    return node.name !== undefined && passed(node.name.text);
  }
  if (!(isArrowFunction(node) || isFunctionExpression(node))) {
    return false;
  }
  const { parent } = node;
  if (isVariableDeclaration(parent)) {
    return isIdentifier(parent.name) && passed(parent.name.text);
  }
  return inline && pageArgument(parent) === node;
}

/** Whether a node sits inside a function that runs in the browser page. */
function runsInPage(
  node: Node,
  inline: boolean,
  passed: (name: string) => boolean
): boolean {
  if (isSourceFile(node)) {
    return false;
  }
  return (
    isPageFunction(node, inline, passed) ||
    runsInPage(node.parent, inline, passed)
  );
}

/**
 * Returns the nodes of a module that run where its imports exist. A function
 * that Playwright serializes into the browser page runs without any import,
 * so Effect cannot replace a platform global inside it. That covers a function
 * written in a `page.evaluate`, `addInitScript`, or sibling call of a
 * Playwright module, and a function this module declares that some Playwright
 * module passes to such a call by reference (`keys`, from `pageFunctionKeys`).
 */
export function outsidePage(
  file: string,
  sourceFile: SourceFile,
  nodes: readonly Node[],
  keys: HashSet.HashSet<string>
) {
  const inline = imports(sourceFile, PLAYWRIGHT_PATTERN);
  const module = moduleKey(file);
  const passed = (name: string) => HashSet.has(keys, functionKey(module, name));
  return Arr.filter(nodes, (node) => !runsInPage(node, inline, passed));
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
    Match.when("strict", () => STRICT_PATTERN.test(file)),
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
