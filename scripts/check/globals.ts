import { Array as Arr, HashSet, Option, Record as Rec } from "effect";
import {
  isAsExpression,
  isElementAccessExpression,
  isIdentifier,
  isNonNullExpression,
  isParenthesizedExpression,
  isPropertyAccessExpression,
  isSatisfiesExpression,
  isStringLiteralLikeNode,
  type Node,
  type SourceFile,
} from "typescript/unstable/ast";
import { candidate, type Rule } from "#scripts/check/rules";

type RuleId = typeof Rule.Type;

/** Platform namespace members whose uses Effect modules replace. */
const MEMBERS: Readonly<Record<string, Readonly<Record<string, RuleId>>>> = {
  Array: { isArray: "array-check" },
  Object: {
    entries: "object-helper",
    fromEntries: "object-helper",
    keys: "object-helper",
    values: "object-helper",
  },
};

const GLOBALS = HashSet.fromIterable(Rec.keys(MEMBERS));
/** Global objects whose members are the same platform globals. */
const GLOBAL_OBJECTS = HashSet.make("global", "globalThis", "self", "window");

/** Whether a node only wraps an expression: parentheses, a non-null assertion, or a type assertion. */
function isWrapper(node: Node) {
  return (
    isParenthesizedExpression(node) ||
    isNonNullExpression(node) ||
    isAsExpression(node) ||
    isSatisfiesExpression(node)
  );
}

/** Returns the outermost expression that only wraps `node`, such as `(Object)`. */
function wrapped(node: Node): Node {
  return isWrapper(node.parent) ? wrapped(node.parent) : node;
}

/** Returns the expression inside every wrapper around it. */
function unwrapped(node: Node): Node {
  return isWrapper(node) ? unwrapped(node.expression) : node;
}

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
 * Returns the rule that a reference to the platform global `name` breaks
 * through the member it reads, such as `Object.keys` or `Array.isArray`.
 */
function globalRule(name: string, reference: Node): Option.Option<RuleId> {
  const outer = wrapped(reference);
  return Option.flatMap(memberRead(outer.parent, outer), (member) =>
    Option.flatMap(Rec.get(MEMBERS, name), (members) =>
      Rec.get(members, member)
    )
  );
}

/** Returns the platform globals one node uses, directly or through a global object. */
function referenceCandidates(sourceFile: SourceFile, node: Node) {
  if (isIdentifier(node)) {
    return HashSet.has(GLOBALS, node.text)
      ? Option.toArray(
          Option.map(globalRule(node.text, node), (rule) =>
            candidate(rule, sourceFile, node, node)
          )
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
  return Option.toArray(
    Option.map(
      Option.flatMap(memberRead(node, node.expression), (name) =>
        globalRule(name, node)
      ),
      (rule) => candidate(rule, sourceFile, node, owner)
    )
  );
}

/**
 * Returns the platform globals among one module's value-position `nodes` that
 * an Effect module replaces: `Array.isArray` and the `Object` helpers. Each
 * counts only while its name binds to the platform global.
 */
export function globalCandidates(
  sourceFile: SourceFile,
  nodes: readonly Node[]
) {
  return Arr.flatMap(nodes, (node) => referenceCandidates(sourceFile, node));
}
