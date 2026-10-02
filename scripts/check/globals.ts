import { Array as Arr, HashSet, Option, Record as Rec } from "effect";
import {
  type ExpressionWithTypeArguments,
  isBinaryExpression,
  isCallExpression,
  isClassDeclaration,
  isClassExpression,
  isDeleteExpression,
  isElementAccessExpression,
  isExpressionWithTypeArguments,
  isHeritageClause,
  isIdentifier,
  isImportDeclaration,
  isNamedImports,
  isNewExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isStringLiteral,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { candidate, type Rule } from "#scripts/check/rules";

type RuleId = typeof Rule.Type;

/** Platform constructors whose instances Effect modules replace. */
const CONSTRUCTED: Readonly<Record<string, RuleId>> = {
  Date: "clock",
  Map: "map-set",
  Promise: "promise",
  Set: "map-set",
};

/** Platform functions whose calls Effect services replace. */
const CALLED: Readonly<Record<string, RuleId>> = {
  fetch: "fetch",
  setInterval: "timer",
  setTimeout: "timer",
};

/** Platform namespace members whose uses Effect modules replace. */
const MEMBERS: Readonly<Record<string, Readonly<Record<string, RuleId>>>> = {
  Array: { isArray: "array-check" },
  Date: { now: "clock" },
  JSON: { parse: "json", stringify: "json" },
  Math: { random: "random" },
  Object: {
    entries: "object-helper",
    fromEntries: "object-helper",
    keys: "object-helper",
    values: "object-helper",
  },
  process: { env: "env" },
};

const ERROR_CLASSES = HashSet.make(
  "AggregateError",
  "Error",
  "EvalError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "TypeError",
  "URIError"
);
const GLOBALS = HashSet.union(
  HashSet.fromIterable(
    Arr.flatten([
      Rec.keys(CONSTRUCTED),
      Rec.keys(CALLED),
      Rec.keys(MEMBERS),
      ["console"],
    ])
  ),
  ERROR_CLASSES
);
/** Global objects whose members are the same platform globals. */
const GLOBAL_OBJECTS = HashSet.make("globalThis", "self", "window");
/** Variables bundlers replace at build time, which no runtime Config read can stand in for. */
const BUILD_CONSTANTS = HashSet.make("NEXT_RUNTIME", "NODE_ENV");
const ENV_FACTORIES = HashSet.make("@t3-oss/env-core", "@t3-oss/env-nextjs");
const RUNTIME_ENV = HashSet.make("experimental__runtimeEnv", "runtimeEnv");
const ASSIGNMENTS = HashSet.make(
  SyntaxKind.AmpersandAmpersandEqualsToken,
  SyntaxKind.BarBarEqualsToken,
  SyntaxKind.EqualsToken,
  SyntaxKind.QuestionQuestionEqualsToken
);

/** Whether `node` reads a member or element of `owner`. */
function accesses(node: Node, owner: Node) {
  return (
    (isPropertyAccessExpression(node) || isElementAccessExpression(node)) &&
    node.expression === owner
  );
}

/**
 * Whether a `process.env` access stays outside runtime configuration: it only
 * assigns or deletes a variable, as test setup does, or it reads a build
 * constant that the bundler inlines.
 */
function bypassesConfig(env: Node) {
  const access = env.parent;
  if (!accesses(access, env)) {
    return false;
  }
  const { parent } = access;
  return (
    (isPropertyAccessExpression(access) &&
      HashSet.has(BUILD_CONSTANTS, access.name.text)) ||
    isDeleteExpression(parent) ||
    (isBinaryExpression(parent) &&
      parent.left === access &&
      HashSet.has(ASSIGNMENTS, parent.operatorToken.kind))
  );
}

/** Returns the expression a `process.env` access contributes to its object. */
function envValue(env: Node) {
  const access = env.parent;
  if (!accesses(access, env)) {
    return env;
  }
  const entry = access.parent;
  return isPropertyAssignment(entry) && entry.initializer === access
    ? entry.parent
    : access;
}

/**
 * Whether a `process.env` access is a value of the `runtimeEnv` mapping in a
 * t3 `createEnv` call, the seam where Next.js inlines public variables.
 */
function isRuntimeEnv(env: Node) {
  const value = envValue(env);
  const property = value.parent;
  if (
    !(
      isPropertyAssignment(property) &&
      property.initializer === value &&
      isIdentifier(property.name) &&
      HashSet.has(RUNTIME_ENV, property.name.text)
    )
  ) {
    return false;
  }
  const call = property.parent.parent;
  return (
    isCallExpression(call) &&
    isIdentifier(call.expression) &&
    call.expression.text === "createEnv"
  );
}

/** Whether the module imports `createEnv` from a t3 env package. */
function importsEnvFactory(sourceFile: SourceFile) {
  return Arr.some(sourceFile.statements, (statement) => {
    if (
      !(
        isImportDeclaration(statement) &&
        isStringLiteral(statement.moduleSpecifier) &&
        HashSet.has(ENV_FACTORIES, statement.moduleSpecifier.text)
      )
    ) {
      return false;
    }
    const bindings = statement.importClause?.namedBindings;
    return (
      bindings !== undefined &&
      isNamedImports(bindings) &&
      Arr.some(bindings.elements, ({ name }) => name.text === "createEnv")
    );
  });
}

/**
 * Returns the rule that a reference to the platform global `name` breaks
 * through its use, such as `new Map()`, `JSON.parse`, or `fetch(...)`.
 */
function globalRule(
  name: string,
  reference: Node,
  envSeam: boolean
): Option.Option<RuleId> {
  const { parent } = reference;
  if (isNewExpression(parent) && parent.expression === reference) {
    const dated =
      name === "Date" && !Arr.isReadonlyArrayEmpty(parent.arguments ?? []);
    return dated ? Option.none() : Rec.get(CONSTRUCTED, name);
  }
  if (isCallExpression(parent) && parent.expression === reference) {
    return Rec.get(CALLED, name);
  }
  if (
    !(isPropertyAccessExpression(parent) && parent.expression === reference)
  ) {
    return Option.none();
  }
  if (name === "console") {
    return Option.some("console");
  }
  if (
    name === "process" &&
    (bypassesConfig(parent) || (envSeam && isRuntimeEnv(parent)))
  ) {
    return Option.none();
  }
  return Option.flatMap(Rec.get(MEMBERS, name), (members) =>
    Rec.get(members, parent.name.text)
  );
}

/** Whether a heritage expression names the class a class declaration or expression extends. */
function extendsClass(node: ExpressionWithTypeArguments) {
  const clause = node.parent;
  return (
    isHeritageClause(clause) &&
    clause.token === SyntaxKind.ExtendsKeyword &&
    (isClassDeclaration(clause.parent) || isClassExpression(clause.parent))
  );
}

/** Returns the platform globals one node uses, directly or through a global object. */
function referenceCandidates(
  sourceFile: SourceFile,
  node: Node,
  envSeam: boolean
) {
  if (isIdentifier(node) && HashSet.has(GLOBALS, node.text)) {
    return Option.toArray(
      Option.map(globalRule(node.text, node, envSeam), (rule) =>
        candidate(rule, sourceFile, node, node)
      )
    );
  }
  if (
    isPropertyAccessExpression(node) &&
    isIdentifier(node.expression) &&
    HashSet.has(GLOBAL_OBJECTS, node.expression.text) &&
    HashSet.has(GLOBALS, node.name.text)
  ) {
    const owner = node.expression;
    return Option.toArray(
      Option.map(globalRule(node.name.text, node, envSeam), (rule) =>
        candidate(rule, sourceFile, node, owner)
      )
    );
  }
  return isExpressionWithTypeArguments(node) &&
    isIdentifier(node.expression) &&
    HashSet.has(ERROR_CLASSES, node.expression.text) &&
    extendsClass(node)
    ? [candidate("error-class", sourceFile, node, node.expression)]
    : [];
}

/**
 * Returns the platform globals among one module's value-position `nodes` that
 * an Effect module replaces, such as `Map`, `JSON`, `fetch`, `process.env`,
 * `Date.now`, timers, `console`, and classes that extend `Error`. Each counts
 * only while its name binds to the platform global.
 */
export function globalCandidates(
  sourceFile: SourceFile,
  nodes: readonly Node[]
) {
  const envSeam = importsEnvFactory(sourceFile);
  return Arr.flatMap(nodes, (node) =>
    referenceCandidates(sourceFile, node, envSeam)
  );
}
