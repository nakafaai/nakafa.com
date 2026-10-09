import { Array as Arr } from "effect";
import {
  isAsExpression,
  isIdentifier,
  isNonNullExpression,
  isSatisfiesExpression,
  isTypeAssertion,
  isTypeReferenceNode,
  type Node,
  type SourceFile,
  type TypeNode,
} from "typescript/unstable/ast";
import { candidate } from "#scripts/check/rules";

/** Whether a type is the bare name `const`, which `as const` and `<const>` spell. */
function isConstType(type: TypeNode) {
  return (
    isTypeReferenceNode(type) &&
    isIdentifier(type.typeName) &&
    type.typeName.text === "const"
  );
}

/** Returns the type that an `as` or angle-bracket assertion names, and `undefined` for any other node. */
function assertedType(node: Node): TypeNode | undefined {
  return isAsExpression(node) || isTypeAssertion(node) ? node.type : undefined;
}

/**
 * Whether one node is an assertion that this rule reports: an `as` or
 * angle-bracket assertion to any type but `const`, a non-null assertion, or a
 * `satisfies` expression. The `as` of an import, an export, or a mapped type is
 * not an expression, so the rule never sees it.
 */
export function isAssertion(node: Node) {
  if (isNonNullExpression(node) || isSatisfiesExpression(node)) {
    return true;
  }
  const type = assertedType(node);
  return type !== undefined && !isConstType(type);
}

/** Describes one candidate per assertion among one module's value-position nodes. */
export function assertionCandidates(
  sourceFile: SourceFile,
  nodes: readonly Node[]
) {
  return Arr.map(Arr.filter(nodes, isAssertion), (node) =>
    candidate("assertion", sourceFile, node)
  );
}
