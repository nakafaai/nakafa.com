import { Array as Arr, HashSet, Option, Record as Rec, Result } from "effect";
import {
  type ExpressionWithTypeArguments,
  type Identifier,
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
import { loadsImport } from "#scripts/check/kinds";
import { candidate, type Rule } from "#scripts/check/rules";
import type { Binding } from "#scripts/check/source";
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
/** The module and the function that own the environment seam of code that Next.js bundles. */
const ENV_SEAM_MODULE = "@repo/utilities/env";
const ENV_SEAM = "readEnvironment";
/** The bindings of a seam callee that is not the import of the seam. */
const NOT_IMPORTED: readonly (typeof Binding.Type)[] = ["global", "local"];
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

/**
 * Returns the callee of the `readEnvironment` call whose record holds this
 * `process.env` access as `NAME: process.env.NAME`, in the object literal of its
 * second argument. That is the seam where Next.js inlines public variables, so
 * the read is a plain property access of the bare `process`, and its key is the
 * name of the variable. The read is exempt only while that callee binds as the
 * module's import, which the caller proves with the compiler.
 */
function seamCallee(env: Node): Option.Option<Identifier> {
  const access = env.parent;
  if (
    !(
      isPropertyAccessExpression(env) &&
      isIdentifier(env.expression) &&
      isPropertyAccessExpression(access) &&
      access.expression === env
    )
  ) {
    return Option.none();
  }
  const entry = access.parent;
  if (
    !(
      isPropertyAssignment(entry) &&
      entry.initializer === access &&
      isIdentifier(entry.name) &&
      entry.name.text === access.name.text
    )
  ) {
    return Option.none();
  }
  const record = entry.parent;
  const call = record.parent;
  return isCallExpression(call) &&
    call.arguments[1] === record &&
    isIdentifier(call.expression) &&
    call.expression.text === ENV_SEAM
    ? Option.some(call.expression)
    : Option.none();
}

/** Whether the module imports `readEnvironment`, as a value, from its owner. */
function importsEnvSeam(sourceFile: SourceFile) {
  return Arr.some(sourceFile.statements, (statement) => {
    if (
      !(
        isImportDeclaration(statement) &&
        loadsImport(statement) &&
        isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === ENV_SEAM_MODULE
      )
    ) {
      return false;
    }
    const bindings = statement.importClause?.namedBindings;
    return (
      bindings !== undefined &&
      isNamedImports(bindings) &&
      Arr.some(bindings.elements, ({ name }) => name.text === ENV_SEAM)
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
function directRule(name: string, outer: Node): Option.Option<RuleId> {
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
    if (name === "process" && bypassesConfig(parent)) {
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
 * Returns the identifier that a heritage expression reads a global error class
 * through: the class itself, as in `extends (Error)`, or the global object of
 * `extends globalThis.Error`. The binding check runs on that identifier, so a
 * local declaration of the class or of the global object shadows it.
 */
function errorClassReference(expression: Node): Option.Option<Identifier> {
  const value = unwrapped(expression);
  if (isIdentifier(value)) {
    return HashSet.has(ERROR_CLASSES, value.text)
      ? Option.some(value)
      : Option.none();
  }
  if (
    !(isPropertyAccessExpression(value) || isElementAccessExpression(value))
  ) {
    return Option.none();
  }
  const owner = unwrapped(value.expression);
  return Option.flatMap(memberRead(value, value.expression), (member) =>
    isIdentifier(owner) &&
    HashSet.has(GLOBAL_OBJECTS, owner.text) &&
    HashSet.has(ERROR_CLASSES, member)
      ? Option.some(owner)
      : Option.none()
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
      Option.map(directRule(name, outer), (rule) => ({
        at: reference,
        rule,
        seam:
          envSeam && rule === "env"
            ? seamCallee(outer.parent)
            : Option.none<Identifier>(),
      }))
    ),
    ...Arr.filterMap(destructured(outer), ({ at, member }) =>
      Option.match(memberRule(name, member), {
        onNone: () => Result.failVoid,
        onSome: (rule) =>
          Result.succeed({ at, rule, seam: Option.none<Identifier>() }),
      })
    ),
  ];
}

/**
 * Returns one use as a candidate. It counts while `binder` is the platform
 * global. A read inside the environment seam counts instead while the callee of
 * its call is not the module's import, so a local `readEnvironment` exempts
 * nothing.
 */
function useCandidate(
  sourceFile: SourceFile,
  binder: Identifier,
  { at, rule, seam }: ReturnType<typeof globalUses>[number]
) {
  return Option.match(seam, {
    onNone: () => candidate(rule, sourceFile, at, binder),
    onSome: (callee) => candidate(rule, sourceFile, at, callee, NOT_IMPORTED),
  });
}

/** Returns the platform globals one node uses, directly or through a global object. */
function referenceCandidates(
  sourceFile: SourceFile,
  node: Node,
  envSeam: boolean
) {
  if (isIdentifier(node)) {
    return HashSet.has(GLOBALS, node.text)
      ? Arr.map(globalUses(node.text, node, envSeam), (use) =>
          useCandidate(sourceFile, node, use)
        )
      : [];
  }
  if (isExpressionWithTypeArguments(node)) {
    return extendsClass(node)
      ? Arr.map(
          Option.toArray(errorClassReference(node.expression)),
          (reference) => candidate("error-class", sourceFile, node, reference)
        )
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
        ? Arr.map(globalUses(name, node, envSeam), (use) =>
            useCandidate(sourceFile, owner, use)
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
  const envSeam = importsEnvSeam(sourceFile);
  return Arr.flatMap(nodes, (node) =>
    referenceCandidates(sourceFile, node, envSeam)
  );
}
