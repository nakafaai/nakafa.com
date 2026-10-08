import { Array as Arr, HashSet } from "effect";
import {
  isArrayTypeNode,
  isArrowFunction,
  isCallExpression,
  isDeclareKeyword,
  isIdentifier,
  isInterfaceDeclaration,
  isIntersectionTypeNode,
  isLiteralTypeNode,
  isModuleDeclaration,
  isNamedTupleMember,
  isNumericLiteral,
  isOptionalTypeNode,
  isParenthesizedTypeNode,
  isPropertyAccessExpression,
  isPropertySignatureDeclaration,
  isQualifiedName,
  isRestTypeNode,
  isSourceFile,
  isStringLiteral,
  isTupleTypeNode,
  isTypeAliasDeclaration,
  isTypeLiteralNode,
  isTypeOperatorNode,
  isTypeReferenceNode,
  isUnionTypeNode,
  type Node,
  type SourceFile,
  SyntaxKind,
  type TypeNode,
  type TypeReferenceNode,
} from "typescript/unstable/ast";
import { candidate } from "#scripts/check/rules";

const JSX_PATTERN = /\.tsx$/u;
const PROPS_PATTERN = /Props$/u;
/** The utility types that pick union members with a selector as their second argument. */
const SELECTOR_FILTERS = HashSet.make("Exclude", "Extract");
/** The Schema types whose type argument a recursive `Schema.suspend` thunk returns. */
const RECURSIVE_CODECS = HashSet.make("Codec", "Schema");

/** Whether a type is a string, number, or boolean literal, or a union of them. */
function isLiteralType(type: TypeNode): boolean {
  if (isUnionTypeNode(type)) {
    return Arr.every(type.types, isLiteralType);
  }
  return (
    isLiteralTypeNode(type) &&
    (isStringLiteral(type.literal) ||
      isNumericLiteral(type.literal) ||
      type.literal.kind === SyntaxKind.TrueKeyword ||
      type.literal.kind === SyntaxKind.FalseKeyword)
  );
}

/**
 * Whether a type is an object literal of one or more properties, each with a
 * literal type, such as `{ readonly family: "program" }`.
 */
function isSelector(type: TypeNode | undefined): boolean {
  return (
    type !== undefined &&
    isTypeLiteralNode(type) &&
    !Arr.isReadonlyArrayEmpty(type.members) &&
    Arr.every(
      type.members,
      (member) =>
        isPropertySignatureDeclaration(member) &&
        member.type !== undefined &&
        isLiteralType(member.type)
    )
  );
}

/**
 * Whether a type reference is `Extract` or `Exclude` with a selector as its
 * second argument. The selector picks union members by a discriminant, so it
 * declares no data shape of its own.
 */
function selectsMembers(type: TypeReferenceNode) {
  return (
    isIdentifier(type.typeName) &&
    HashSet.has(SELECTOR_FILTERS, type.typeName.text) &&
    isSelector(type.typeArguments?.[1])
  );
}

/**
 * Whether a type spells out an object literal, directly or through a union,
 * intersection, array, tuple, `readonly`, or a type argument such as
 * `Readonly<{ ... }>`.
 */
function spellsObject(type: TypeNode): boolean {
  if (isTypeLiteralNode(type)) {
    return true;
  }
  if (
    isParenthesizedTypeNode(type) ||
    isTypeOperatorNode(type) ||
    isOptionalTypeNode(type) ||
    isRestTypeNode(type) ||
    isNamedTupleMember(type)
  ) {
    return spellsObject(type.type);
  }
  if (isArrayTypeNode(type)) {
    return spellsObject(type.elementType);
  }
  if (isUnionTypeNode(type) || isIntersectionTypeNode(type)) {
    return Arr.some(type.types, spellsObject);
  }
  if (isTupleTypeNode(type)) {
    return Arr.some(type.elements, spellsObject);
  }
  if (!isTypeReferenceNode(type)) {
    return false;
  }
  const args = type.typeArguments ?? [];
  return Arr.some(
    selectsMembers(type) ? Arr.take(args, 1) : args,
    spellsObject
  );
}

/**
 * Whether a declaration sits inside `declare module` or `declare global`,
 * where it augments a framework or platform type that no Schema can own.
 */
function isAmbient(node: Node): boolean {
  const { parent } = node;
  if (isSourceFile(parent)) {
    return false;
  }
  return (
    (isModuleDeclaration(parent) &&
      Arr.some(parent.modifiers ?? [], isDeclareKeyword)) ||
    isAmbient(parent)
  );
}

/**
 * Returns the type that a `Schema.suspend` thunk returns, such as
 * `Schema.Codec<Category>` in `Schema.suspend((): Schema.Codec<Category> => ...)`.
 */
function suspendedType(node: Node) {
  if (
    !(
      isCallExpression(node) &&
      isPropertyAccessExpression(node.expression) &&
      isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "Schema" &&
      node.expression.name.text === "suspend"
    )
  ) {
    return;
  }
  const [thunk] = node.arguments;
  return thunk !== undefined && isArrowFunction(thunk) ? thunk.type : undefined;
}

/**
 * Returns the names that recursive schemas give their types. Effect's guide
 * annotates each recursive `Schema.suspend` thunk with `Schema.Codec<Name>`
 * (`repos/effect/packages/effect/SCHEMA.md`, Recursive Schemas, lines
 * 2235-2255), because the schema refers to a type that its own initializer
 * declares, which a `typeof X.Type` self-reference cannot express.
 */
function recursiveNames(nodes: readonly Node[]) {
  return Arr.flatMap(nodes, (node) => {
    const returned = suspendedType(node);
    if (
      returned === undefined ||
      !isTypeReferenceNode(returned) ||
      !isQualifiedName(returned.typeName)
    ) {
      return [];
    }
    const { left, right } = returned.typeName;
    const [argument] = returned.typeArguments ?? [];
    return isIdentifier(left) &&
      left.text === "Schema" &&
      HashSet.has(RECURSIVE_CODECS, right.text) &&
      argument !== undefined &&
      isTypeReferenceNode(argument) &&
      isIdentifier(argument.typeName)
      ? [argument.typeName.text]
      : [];
  });
}

/**
 * Returns the hand-written data shapes among one module's `nodes`: interfaces
 * that declare their own members and type aliases that spell out an object.
 * React component props in `.tsx` modules, ambient augmentations, interfaces
 * that only extend a derived type, and the type a recursive schema names stay
 * allowed.
 */
export function shapeCandidates(
  file: string,
  sourceFile: SourceFile,
  nodes: readonly Node[]
) {
  const props = JSX_PATTERN.test(file);
  const recursive = recursiveNames(nodes);
  return Arr.flatMap(nodes, (node) => {
    if (!(isInterfaceDeclaration(node) || isTypeAliasDeclaration(node))) {
      return [];
    }
    const handWritten = isInterfaceDeclaration(node)
      ? !Arr.isReadonlyArrayEmpty(node.members) ||
        node.heritageClauses === undefined
      : spellsObject(node.type);
    const allowed =
      (props && PROPS_PATTERN.test(node.name.text)) ||
      isAmbient(node) ||
      Arr.contains(recursive, node.name.text);
    return handWritten && !allowed
      ? [candidate("data-type", sourceFile, node.name)]
      : [];
  });
}
