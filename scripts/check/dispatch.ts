import { Array as Arr, HashSet, Option } from "effect";
import {
  type Expression,
  type IfStatement,
  isBinaryExpression,
  isBlock,
  isCaseClause,
  isDefaultClause,
  isIfStatement,
  isModuleBlock,
  isNoSubstitutionTemplateLiteral,
  isPrefixUnaryExpression,
  isPropertyAccessExpression,
  isSourceFile,
  isStringLiteral,
  isSwitchStatement,
  type Node,
  type SourceFile,
  type Statement,
  SyntaxKind,
} from "tsrs/ast";
import { candidate } from "#scripts/check/rules";
import { unwrapped } from "#scripts/check/wrapper";

/** The property that names the variant of a tagged value. */
const TAG = "_tag";
/** The operators that compare a tag with one variant. */
const EQUALITY = HashSet.make(
  SyntaxKind.EqualsEqualsEqualsToken,
  SyntaxKind.ExclamationEqualsEqualsToken,
  SyntaxKind.EqualsEqualsToken,
  SyntaxKind.ExclamationEqualsToken
);

/**
 * The subjects whose `_tag` a condition compares with a variant, by source
 * text: `x._tag === "A"`, its negation, and a `||` of such comparisons.
 */
function tagSubjects(
  sourceFile: SourceFile,
  condition: Expression
): readonly string[] {
  const node = unwrapped(condition);
  if (
    isPrefixUnaryExpression(node) &&
    node.operator === SyntaxKind.ExclamationToken
  ) {
    return tagSubjects(sourceFile, node.operand);
  }
  if (!isBinaryExpression(node)) {
    return [];
  }
  const operator = node.operatorToken.kind;
  if (operator === SyntaxKind.BarBarToken) {
    return Arr.appendAll(
      tagSubjects(sourceFile, node.left),
      tagSubjects(sourceFile, node.right)
    );
  }
  if (!HashSet.has(EQUALITY, operator)) {
    return [];
  }
  return Arr.flatMap(
    [
      [node.left, node.right],
      [node.right, node.left],
    ] as const,
    ([tag, variant]) => {
      const read = unwrapped(tag);
      return isPropertyAccessExpression(read) &&
        read.name.text === TAG &&
        (isStringLiteral(unwrapped(variant)) ||
          isNoSubstitutionTemplateLiteral(unwrapped(variant)))
        ? [read.expression.getText(sourceFile)]
        : [];
    }
  );
}

/** The statements of the list that holds `node`, or none when its parent holds no statement list. */
function siblings(node: Node): readonly Statement[] {
  const { parent } = node;
  return isBlock(parent) ||
    isSourceFile(parent) ||
    isModuleBlock(parent) ||
    isCaseClause(parent) ||
    isDefaultClause(parent)
    ? parent.statements
    : [];
}

/** Whether two `if` statements test the tag of one subject. */
function sharesSubject(
  sourceFile: SourceFile,
  first: IfStatement,
  second: Node | undefined
) {
  return (
    second !== undefined &&
    isIfStatement(second) &&
    Arr.some(tagSubjects(sourceFile, first.expression), (subject) =>
      Arr.contains(tagSubjects(sourceFile, second.expression), subject)
    )
  );
}

/** The statement right before and right after `node` in its list. */
function neighbours(node: IfStatement) {
  const list = siblings(node);
  const at = Arr.findFirstIndex(list, (statement) => statement === node);
  return {
    next: Option.getOrUndefined(
      Option.flatMap(at, (index) => Arr.get(list, index + 1))
    ),
    previous: Option.getOrUndefined(
      Option.flatMap(at, (index) => Arr.get(list, index - 1))
    ),
  };
}

/**
 * Whether an `if` over a subject's `_tag` starts a chain over the same tag:
 * its `else` or its next statement is an `if` over that tag, and no `if` over
 * it comes before, as the `if` this one is the `else` of or the statement
 * before it. A chain is reported once, at its first `if`.
 */
function startsTagChain(sourceFile: SourceFile, node: IfStatement) {
  const { next, previous } = neighbours(node);
  const { parent } = node;
  const continues =
    (isIfStatement(parent) &&
      parent.elseStatement === node &&
      sharesSubject(sourceFile, node, parent)) ||
    sharesSubject(sourceFile, node, previous);
  return (
    !continues &&
    (sharesSubject(sourceFile, node, node.elseStatement) ||
      sharesSubject(sourceFile, node, next))
  );
}

/**
 * Describes one candidate per switch statement, and one per chain of `if`
 * statements over the same subject's `_tag`, among one module's value-position
 * nodes. Both pick a branch by the value's shape, which Match from effect
 * names with its tag and discriminator matchers.
 */
export function dispatchCandidates(
  sourceFile: SourceFile,
  nodes: readonly Node[]
) {
  return Arr.appendAll(
    Arr.map(Arr.filter(nodes, isSwitchStatement), (node) =>
      candidate("switch", sourceFile, node)
    ),
    Arr.map(
      Arr.filter(
        nodes,
        (node): node is IfStatement =>
          isIfStatement(node) && startsTagChain(sourceFile, node)
      ),
      (node) => candidate("tag-chain", sourceFile, node)
    )
  );
}
