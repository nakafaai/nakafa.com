import { Array as Arr, HashSet, Option, Record as Rec } from "effect";
import {
  isIdentifier,
  isPropertyAccessExpression,
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
 * Returns the rule that a reference to the platform global `name` breaks
 * through the member it reads, such as `Object.keys` or `Array.isArray`.
 */
function globalRule(name: string, reference: Node): Option.Option<RuleId> {
  const { parent } = reference;
  if (
    !(isPropertyAccessExpression(parent) && parent.expression === reference)
  ) {
    return Option.none();
  }
  return Option.flatMap(Rec.get(MEMBERS, name), (members) =>
    Rec.get(members, parent.name.text)
  );
}

/** Returns the platform globals one node uses, directly or through a global object. */
function referenceCandidates(sourceFile: SourceFile, node: Node) {
  if (isIdentifier(node) && HashSet.has(GLOBALS, node.text)) {
    return Option.toArray(
      Option.map(globalRule(node.text, node), (rule) =>
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
      Option.map(globalRule(node.name.text, node), (rule) =>
        candidate(rule, sourceFile, node, owner)
      )
    );
  }
  return [];
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
