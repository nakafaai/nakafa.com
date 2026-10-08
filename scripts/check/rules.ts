import { Array as Arr, Match, Schema } from "effect";
import {
  type Identifier,
  isExportAssignment,
  isIdentifier,
  isImportDeclaration,
  isNamedImports,
  isSatisfiesExpression,
  isStringLiteral,
  isTypeReferenceNode,
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
  "clock",
  "console",
  "data-type",
  "env",
  "error-class",
  "fetch",
  "json",
  "map-set",
  "node-module",
  "object-helper",
  "promise",
  "random",
  "timer",
  "try-catch",
  "typeof-object",
]);

/**
 * The authored modules a rule inspects: every module, code outside framework
 * configuration, code outside React modules, the strict Confect and script
 * modules, or their domain code without tests.
 */
const RuleScope = Schema.Literals([
  "every",
  "code",
  "logic",
  "strict",
  "domain",
]);

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
  clock: {
    message:
      "read time from Clock or DateTime.now in effect, or DateTime.nowUnsafe in synchronous React code, instead of Date.now or new Date().",
    scope: "code",
  },
  console: {
    message:
      "log through Effect.log or the Console module in effect instead of console.",
    scope: "code",
  },
  "data-type": {
    message:
      "derive this shape from an Effect Schema with typeof X.Type, or declare a service shape inline in Context.Service, instead of a hand-written interface or object type.",
    scope: "code",
  },
  env: {
    message:
      "read configuration through Config in effect, or the createEnv runtimeEnv seam in Next.js, instead of process.env; only the bundler-inlined NODE_ENV and NEXT_RUNTIME stay direct.",
    scope: "code",
  },
  "error-class": {
    message:
      "define expected failures with Schema.TaggedError or Data.TaggedError instead of a class that extends Error.",
    scope: "code",
  },
  fetch: {
    message: "call HTTP through HttpClient from effect/http instead of fetch.",
    scope: "code",
  },
  json: {
    message:
      "decode and encode JSON through Schema.fromJsonString instead of JSON.parse or JSON.stringify.",
    scope: "code",
  },
  "map-set": {
    message:
      "use HashMap or HashSet from effect, or MutableHashMap or MutableHashSet for local mutation, instead of a native Map or Set.",
    scope: "code",
  },
  "node-module": {
    message:
      "use FileSystem, Path, and ChildProcess from effect with NodeServices from @effect/platform-node instead of node:fs, node:path, or node:child_process.",
    scope: "code",
  },
  "object-helper": {
    message:
      "use Record.keys, Record.values, Record.toEntries, or Record.fromEntries from effect instead of the Object helper.",
    scope: "code",
  },
  promise: {
    message:
      "compose Effects with Effect.fn, wrapping a Promise SDK once in Effect.tryPromise, instead of new Promise, async functions, or await.",
    scope: "domain",
  },
  random: {
    message: "draw random values from Random in effect instead of Math.random.",
    scope: "code",
  },
  timer: {
    message:
      "schedule with Effect.sleep, Effect.delay, or Schedule and Duration from effect instead of setTimeout or setInterval outside React modules.",
    scope: "logic",
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
const STRICT_PATTERN = /^(?:packages\/backend\/confect|scripts)\//u;
/** Tests and the `test.*.ts` modules that set up and support them. */
const TEST_PATTERN = /(?:\.test\.tsx?|(?:^|\/)test\.[^/]+\.ts)$/u;
const JSX_PATTERN = /\.tsx$/u;
const REACT_PATTERN = /^react(?:-dom)?(?:\/|$)/u;
const GLOBAL_ONLY: readonly (typeof Binding.Type)[] = ["global"];
/** Framework configuration types name what they configure, such as `NextConfig` or Convex's `AuthConfig`. */
const CONFIGURATION_TYPE_PATTERN = /Config$/u;
/** Relative paths, app aliases, and workspace packages name repository modules rather than framework packages. */
export const REPOSITORY_SPECIFIER_PATTERN = /^(?:\.|@\/|@repo\/|#)/u;

/** Whether a module imports a module specifier that `pattern` matches. */
export function imports(sourceFile: SourceFile, pattern: RegExp) {
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
      REPOSITORY_SPECIFIER_PATTERN.test(statement.moduleSpecifier.text)
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

/** Whether a module renders or hooks into React, where timers belong to effects and handlers. */
function isReactModule(file: string, sourceFile: SourceFile) {
  return JSX_PATTERN.test(file) || imports(sourceFile, REACT_PATTERN);
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
    Match.when(
      "logic",
      () =>
        !(isConfiguration(file, sourceFile) || isReactModule(file, sourceFile))
    ),
    Match.when("strict", () => STRICT_PATTERN.test(file)),
    Match.when(
      "domain",
      () => STRICT_PATTERN.test(file) && !TEST_PATTERN.test(file)
    ),
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
