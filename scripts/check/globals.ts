import { Array as Arr, HashSet, Option, Record as Rec, Result } from "effect";
import {
  isAsExpression,
  isElementAccessExpression,
  isIdentifier,
  isNonNullExpression,
  isObjectBindingPattern,
  isParenthesizedExpression,
  isPropertyAccessExpression,
  isSatisfiesExpression,
  isStringLiteralLikeNode,
  isVariableDeclaration,
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

/**
 * Returns each prohibited member that a reference to the platform global
 * `name` uses, with the node that names it: a member it reads, such as
 * `Object.keys`, and the members a declaration destructures from it.
 */
function globalUses(name: string, reference: Node) {
  const outer = wrapped(reference);
  return Arr.flatMap(Option.toArray(Rec.get(MEMBERS, name)), (members) => [
    ...Option.toArray(
      Option.map(
        Option.flatMap(memberRead(outer.parent, outer), (member) =>
          Rec.get(members, member)
        ),
        (rule) => ({ at: reference, rule })
      )
    ),
    ...Arr.filterMap(destructured(outer), ({ at, member }) =>
      Option.match(Rec.get(members, member), {
        onNone: () => Result.failVoid,
        onSome: (rule) => Result.succeed({ at, rule }),
      })
    ),
  ]);
}

/** Returns the platform globals one node uses, directly or through a global object. */
function referenceCandidates(sourceFile: SourceFile, node: Node) {
  if (isIdentifier(node)) {
    return HashSet.has(GLOBALS, node.text)
      ? Arr.map(globalUses(node.text, node), ({ at, rule }) =>
          candidate(rule, sourceFile, at, node)
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
      Arr.map(globalUses(name, node), ({ at, rule }) =>
        candidate(rule, sourceFile, at, owner)
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
