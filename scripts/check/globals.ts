import { Array as Arr, HashSet, Option, Record as Rec, Result } from "effect";
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
  isObjectBindingPattern,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isStringLiteral,
  isStringLiteralLikeNode,
  isVariableDeclaration,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { candidate, type Rule } from "#scripts/check/rules";
import { unwrapped, wrapped } from "#scripts/check/wrapper";

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
  queueMicrotask: "timer",
  setImmediate: "timer",
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
  crypto: { randomUUID: "random" },
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
const GLOBAL_OBJECTS = HashSet.make("global", "globalThis", "self", "window");
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

/**
 * Returns the member a node reads from `owner`, written as a property or as an
 * element access with a string literal, such as `Object.keys` or
 * `Object["keys"]`.
 */
function memberRead(node: Node, owner: Node): Option.Option<string> {
  if (isPropertyAccessExpression(node) && node.expression === owner) {
    return Option.some(node.name.text);
  }
  return isElementAccessExpression(node) &&
    node.expression === owner &&
    isStringLiteralLikeNode(node.argumentExpression)
    ? Option.some(node.argumentExpression.text)
    : Option.none();
}

/**
 * Returns the members a declaration destructures from `outer`, such as `keys`
 * and `values` in `const { keys, values: read } = Object`.
 */
function destructured(outer: Node) {
  const declaration = outer.parent;
  if (
    !(
      isVariableDeclaration(declaration) &&
      declaration.initializer === outer &&
      isObjectBindingPattern(declaration.name)
    )
  ) {
    return [];
  }
  return Arr.flatMap(declaration.name.elements, (element) =>
    Arr.filterMap(
      Arr.fromNullishOr(element.propertyName ?? element.name),
      (property) =>
        isIdentifier(property) || isStringLiteralLikeNode(property)
          ? Result.succeed({ at: element, member: property.text })
          : Result.failVoid
    )
  );
}

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

/** Returns the rule that a member of the platform namespace `name` breaks, such as `Object.keys`. */
function memberRule(name: string, member: string) {
  return Option.flatMap(Rec.get(MEMBERS, name), (members) =>
    Rec.get(members, member)
  );
}

/**
 * Returns the rule that the platform global `name` breaks through a direct
 * use of its wrapped expression `outer`: a constructor, a call, or a member it
 * reads.
 */
function directRule(
  name: string,
  outer: Node,
  envSeam: boolean
): Option.Option<RuleId> {
  const { parent } = outer;
  if (isNewExpression(parent) && parent.expression === outer) {
    const dated =
      name === "Date" && !Arr.isReadonlyArrayEmpty(parent.arguments ?? []);
    return dated ? Option.none() : Rec.get(CONSTRUCTED, name);
  }
  if (isCallExpression(parent) && parent.expression === outer) {
    // Date() returns the current time as text, whatever its arguments.
    return name === "Date" ? Option.some("clock") : Rec.get(CALLED, name);
  }
  return Option.flatMap(memberRead(parent, outer), (member) => {
    if (name === "console") {
      return Option.some("console");
    }
    if (
      name === "process" &&
      (bypassesConfig(parent) || (envSeam && isRuntimeEnv(parent)))
    ) {
      return Option.none();
    }
    return memberRule(name, member);
  });
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

/**
 * Returns each use of the platform global `name` through `reference`, with the
 * node that names it: a direct use, or a member that a declaration
 * destructures from it.
 */
function globalUses(name: string, reference: Node, envSeam: boolean) {
  const outer = wrapped(reference);
  return [
    ...Option.toArray(
      Option.map(directRule(name, outer, envSeam), (rule) => ({
        at: reference,
        rule,
      }))
    ),
    ...Arr.filterMap(destructured(outer), ({ at, member }) =>
      Option.match(memberRule(name, member), {
        onNone: () => Result.failVoid,
        onSome: (rule) => Result.succeed({ at, rule }),
      })
    ),
  ];
}

/** Returns the platform globals one node uses, directly or through a global object. */
function referenceCandidates(
  sourceFile: SourceFile,
  node: Node,
  envSeam: boolean
) {
  if (isIdentifier(node)) {
    return HashSet.has(GLOBALS, node.text)
      ? Arr.map(globalUses(node.text, node, envSeam), ({ at, rule }) =>
          candidate(rule, sourceFile, at, node)
        )
      : [];
  }
  if (isExpressionWithTypeArguments(node)) {
    return isIdentifier(node.expression) &&
      HashSet.has(ERROR_CLASSES, node.expression.text) &&
      extendsClass(node)
      ? [candidate("error-class", sourceFile, node, node.expression)]
      : [];
  }
  if (!(isPropertyAccessExpression(node) || isElementAccessExpression(node))) {
    return [];
  }
  const owner = unwrapped(node.expression);
  if (!(isIdentifier(owner) && HashSet.has(GLOBAL_OBJECTS, owner.text))) {
    return [];
  }
  return Arr.flatMap(
    Option.toArray(memberRead(node, node.expression)),
    (name) =>
      HashSet.has(GLOBALS, name)
        ? Arr.map(globalUses(name, node, envSeam), ({ at, rule }) =>
            candidate(rule, sourceFile, at, owner)
          )
        : []
  );
}

/**
 * Returns the platform globals among one module's value-position `nodes` that
 * an Effect module replaces, such as `Map`, `JSON`, `fetch`, `process.env`,
 * `Date.now`, timers, `console`, `Array.isArray`, the `Object` helpers, and
 * classes that extend `Error`. Each counts only while its name binds to the
 * platform global.
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
