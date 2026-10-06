import { Array as Arr, HashSet, Option, Record as Rec } from "effect";
import {
  isElementAccessExpression,
  isIdentifier,
  isPropertyAccessExpression,
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
const GLOBAL_OBJECTS = HashSet.make("globalThis", "self", "window");

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
  return Option.flatMap(memberRead(reference.parent, reference), (member) =>
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
  const owner = node.expression;
  if (!(isIdentifier(owner) && HashSet.has(GLOBAL_OBJECTS, owner.text))) {
    return [];
  }
  return Option.toArray(
    Option.map(
      Option.flatMap(memberRead(node, owner), (name) => globalRule(name, node)),
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
