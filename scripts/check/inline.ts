import { Array as Arr } from "effect";
import {
  isArrowFunction,
  isCallExpression,
  isFunctionDeclaration,
  isFunctionExpression,
  isFunctionLikeDeclaration,
  isIdentifier,
  isIntersectionTypeNode,
  isParameterDeclaration,
  isSatisfiesExpression,
  isTypePredicateNode,
  isVariableDeclaration,
  type Node,
  type ParameterDeclaration,
  type SourceFile,
  type TypeNode,
} from "typescript/unstable/ast";
import { candidate } from "#scripts/check/rules";
import { objectLiterals } from "#scripts/check/shapes";
import { valueMembers, valueTypes } from "#scripts/check/value";

const JSX_PATTERN = /\.tsx$/u;
/** A React component is named with a leading capital letter. */
const COMPONENT_PATTERN = /^\p{Lu}/u;

/**
 * Returns the name a function is known by: its own name, or the variable that
 * holds it, also through wrapping calls such as `memo(...)`.
 */
function functionName(node: Node): string | undefined {
  if (
    (isFunctionDeclaration(node) || isFunctionExpression(node)) &&
    node.name !== undefined
  ) {
    return node.name.text;
  }
  const { parent } = node;
  if (isVariableDeclaration(parent) && isIdentifier(parent.name)) {
    return parent.name.text;
  }
  return isCallExpression(parent) ? functionName(parent) : undefined;
}

/**
 * Whether a parameter is the props of a React component: the first parameter
 * of a function with a capitalized name in a `.tsx` module.
 */
function isComponentProps(file: string, parameter: ParameterDeclaration) {
  const owner = parameter.parent;
  if (
    !(
      JSX_PATTERN.test(file) &&
      (isFunctionDeclaration(owner) ||
        isFunctionExpression(owner) ||
        isArrowFunction(owner))
    )
  ) {
    return false;
  }
  const name = functionName(owner);
  return (
    owner.parameters[0] === parameter &&
    name !== undefined &&
    COMPONENT_PATTERN.test(name)
  );
}

/**
 * Returns the type that a node annotates in a data position: the type of a
 * parameter or a variable, the return type of a function, the target of a type
 * predicate, and the target of `satisfies`. Component props are left out.
 */
function annotation(file: string, node: Node): TypeNode | undefined {
  if (isParameterDeclaration(node)) {
    return isComponentProps(file, node) ? undefined : node.type;
  }
  if (isVariableDeclaration(node) || isSatisfiesExpression(node)) {
    return node.type;
  }
  if (!isFunctionLikeDeclaration(node)) {
    return;
  }
  return node.type !== undefined && isTypePredicateNode(node.type)
    ? node.type.type
    : node.type;
}

/**
 * Returns the object types that one module's `runtime` nodes write inline as
 * data: an object type with members, none of which holds a value no Schema
 * describes, in the type of a parameter, a variable, a return type, a type
 * predicate, or a `satisfies` target. One annotation is one candidate.
 *
 * An object type that an intersection joins to a value, such as the second
 * member of `ResponseInit & { readonly url?: string }`, extends that value and
 * is no data shape of its own.
 */
export function inlineCandidates(
  file: string,
  sourceFile: SourceFile,
  runtime: readonly Node[]
) {
  const holdsValue = valueMembers(sourceFile);
  const isValue = valueTypes(sourceFile);
  return Arr.flatMap(runtime, (node) => {
    const written = Arr.filter(
      Arr.flatMap(Arr.fromNullishOr(annotation(file, node)), objectLiterals),
      (literal) =>
        Arr.isReadonlyArrayNonEmpty(literal.members) &&
        !Arr.some(literal.members, holdsValue) &&
        !(isIntersectionTypeNode(literal.parent) && isValue(literal.parent))
    );
    return Arr.map(Arr.take(written, 1), (literal) =>
      candidate("data-type", sourceFile, literal)
    );
  });
}
