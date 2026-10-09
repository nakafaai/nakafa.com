import { Array as Arr, HashSet } from "effect";
import {
  isArrowFunction,
  isCallExpression,
  isFunctionDeclaration,
  isFunctionExpression,
  isFunctionLikeDeclaration,
  isIdentifier,
  isIntersectionTypeNode,
  isParameterDeclaration,
  isParenthesizedTypeNode,
  isPropertySignatureDeclaration,
  isSatisfiesExpression,
  isSourceFile,
  isTypeLiteralNode,
  isTypePredicateNode,
  isTypeReferenceNode,
  isVariableDeclaration,
  type Node,
  type ParameterDeclaration,
  type SourceFile,
  type TypeLiteralNode,
  type TypeNode,
} from "typescript/unstable/ast";
import { candidate } from "#scripts/check/rules";
import { declaredNames, mentions, objectLiterals } from "#scripts/check/shapes";
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

/** The utility types that keep an object type the named arguments it is. */
const ARGUMENT_WRAPPERS = HashSet.make("Partial", "Readonly", "Required");

/**
 * Returns the object types that a parameter's own type holds inside its named
 * arguments. The object type that IS the parameter's type names the arguments
 * of the function, as React props name the inputs of a component, so it is no
 * data shape: alone, joined to another type by an intersection, or inside
 * `Partial`, `Readonly`, or `Required`. An object type inside it, such as the
 * rows of `{ rows: readonly { id: string }[] }`, is one.
 */
function argumentShapes(type: TypeNode): readonly TypeLiteralNode[] {
  if (isParenthesizedTypeNode(type)) {
    return argumentShapes(type.type);
  }
  if (isIntersectionTypeNode(type)) {
    return Arr.flatMap(type.types, argumentShapes);
  }
  if (
    isTypeReferenceNode(type) &&
    isIdentifier(type.typeName) &&
    HashSet.has(ARGUMENT_WRAPPERS, type.typeName.text)
  ) {
    return Arr.flatMap(type.typeArguments ?? [], argumentShapes);
  }
  return isTypeLiteralNode(type)
    ? Arr.flatMap(type.members, (member) =>
        isPropertySignatureDeclaration(member) && member.type !== undefined
          ? objectLiterals(member.type)
          : []
      )
    : objectLiterals(type);
}

/**
 * Returns the object types that a node writes in a data position: inside the
 * named arguments of a parameter, in the type of a variable, in a return type,
 * in the target of a type predicate, and in the target of `satisfies`.
 * Component props are left out.
 */
function writtenShapes(file: string, node: Node): readonly TypeLiteralNode[] {
  if (isParameterDeclaration(node)) {
    return node.type === undefined || isComponentProps(file, node)
      ? []
      : argumentShapes(node.type);
  }
  if (isVariableDeclaration(node) || isSatisfiesExpression(node)) {
    return Arr.flatMap(Arr.fromNullishOr(node.type), objectLiterals);
  }
  if (!isFunctionLikeDeclaration(node) || node.type === undefined) {
    return [];
  }
  return objectLiterals(
    isTypePredicateNode(node.type) ? (node.type.type ?? node.type) : node.type
  );
}

/**
 * Returns the type parameter names in scope at a node: the ones that the
 * functions, classes, and types around it declare.
 */
function scopeParameters(node: Node): readonly string[] {
  const { parent } = node;
  return isSourceFile(parent)
    ? []
    : Arr.appendAll(declaredNames(parent), scopeParameters(parent));
}

/**
 * Whether an object type names a type parameter in scope in one of its
 * members, such as `ToolName` in `{ readonly toolName: ToolName }` inside
 * `function stop<ToolName extends string>(...)`. The caller chooses that type,
 * so no single `typeof X.Type` names the shape, as for a generic interface.
 */
function isGeneric(literal: TypeLiteralNode): boolean {
  const parameters = scopeParameters(literal);
  return Arr.some(literal.members, (member) => mentions(member, parameters));
}

/**
 * Returns the object types that one module's `runtime` nodes write inline as
 * data: an object type with members, none of which holds a value no Schema
 * describes, in a data position. One annotation is one candidate.
 *
 * An object type that an intersection joins to a value, such as the second
 * member of `ResponseInit & { readonly url?: string }`, extends that value and
 * is no data shape of its own. Neither is an object type that names a type
 * parameter in scope.
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
      writtenShapes(file, node),
      (literal) =>
        Arr.isReadonlyArrayNonEmpty(literal.members) &&
        !Arr.some(literal.members, holdsValue) &&
        !(isIntersectionTypeNode(literal.parent) && isValue(literal.parent)) &&
        !isGeneric(literal)
    );
    return Arr.map(Arr.take(written, 1), (literal) =>
      candidate("data-type", sourceFile, literal)
    );
  });
}
