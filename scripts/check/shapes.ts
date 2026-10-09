import { Array as Arr, HashMap, HashSet } from "effect";
import {
  type InterfaceDeclaration,
  isArrayTypeNode,
  isArrowFunction,
  isCallExpression,
  isConditionalTypeNode,
  isDeclareKeyword,
  isIdentifier,
  isInferTypeNode,
  isInterfaceDeclaration,
  isIntersectionTypeNode,
  isLiteralTypeNode,
  isModuleDeclaration,
  isNamedTupleMember,
  isNumericLiteral,
  isOptionalTypeNode,
  isParenthesizedTypeNode,
  isPrefixUnaryExpression,
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
  isTypeParameterDeclaration,
  isTypeReferenceNode,
  isUnionTypeNode,
  type Node,
  type SourceFile,
  SyntaxKind,
  type TypeAliasDeclaration,
  type TypeElement,
  type TypeLiteralNode,
  type TypeNode,
  type TypeReferenceNode,
} from "typescript/unstable/ast";
import { candidate } from "#scripts/check/rules";
import { children } from "#scripts/check/source";
import { localShapes, valueMembers } from "#scripts/check/value";

const JSX_PATTERN = /\.tsx$/u;
const PROPS_PATTERN = /Props$/u;
/** The utility types that pick union members with a selector as their second argument. */
const SELECTOR_FILTERS = HashSet.make("Exclude", "Extract");
/** The Schema types whose type argument a recursive `Schema.suspend` thunk returns. */
const RECURSIVE_CODECS = HashSet.make("Codec", "Schema");
/** An interface or a type alias that a module declares at its top level. */
type Shape = InterfaceDeclaration | TypeAliasDeclaration;

/**
 * Whether a type is a string, number, or boolean literal, or a union of them,
 * with parentheses around any of them and a minus sign before a number.
 */
function isLiteralType(type: TypeNode): boolean {
  if (isParenthesizedTypeNode(type)) {
    return isLiteralType(type.type);
  }
  if (isUnionTypeNode(type)) {
    return Arr.every(type.types, isLiteralType);
  }
  return isLiteralTypeNode(type) && isLiteralValue(type.literal);
}

/** Whether the value of a literal type is a string, a boolean, or a number, possibly negative. */
function isLiteralValue(literal: Node): boolean {
  return (
    isStringLiteral(literal) ||
    isNumericLiteral(literal) ||
    literal.kind === SyntaxKind.TrueKeyword ||
    literal.kind === SyntaxKind.FalseKeyword ||
    (isPrefixUnaryExpression(literal) &&
      literal.operator === SyntaxKind.MinusToken &&
      isNumericLiteral(literal.operand))
  );
}

/**
 * Whether a type is an object literal of one or more properties, each with a
 * literal type or a selector of its own, such as `{ readonly family: "program" }`
 * or `{ translation: { id: "english" } }`.
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
        (isLiteralType(member.type) || isSelector(member.type))
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
 * Returns the object literal types that a type spells out, directly or through
 * a union, intersection, array, tuple, `readonly`, or a type argument such as
 * `Readonly<{ ... }>`. The selector that `Extract` or `Exclude` takes as its
 * second argument is skipped, because it picks union members and declares no
 * shape.
 */
export function objectLiterals(type: TypeNode): readonly TypeLiteralNode[] {
  if (isTypeLiteralNode(type)) {
    return [type];
  }
  if (
    isParenthesizedTypeNode(type) ||
    isTypeOperatorNode(type) ||
    isOptionalTypeNode(type) ||
    isRestTypeNode(type) ||
    isNamedTupleMember(type)
  ) {
    return objectLiterals(type.type);
  }
  if (isArrayTypeNode(type)) {
    return objectLiterals(type.elementType);
  }
  if (isUnionTypeNode(type) || isIntersectionTypeNode(type)) {
    return Arr.flatMap(type.types, objectLiterals);
  }
  if (isTupleTypeNode(type)) {
    return Arr.flatMap(type.elements, objectLiterals);
  }
  if (!isTypeReferenceNode(type)) {
    return [];
  }
  const args = type.typeArguments ?? [];
  return Arr.flatMap(
    selectsMembers(type) ? Arr.take(args, 1) : args,
    objectLiterals
  );
}

/**
 * Whether a module declaration augments a framework or platform type: a
 * `declare module "name"` block or a `declare global` block. A `declare
 * namespace` declares its own shapes, so it does not count.
 */
function isAugmentation(node: Node): boolean {
  return (
    isModuleDeclaration(node) &&
    Arr.some(node.modifiers ?? [], isDeclareKeyword) &&
    (isStringLiteral(node.name) ||
      (isIdentifier(node.name) && node.name.text === "global"))
  );
}

/**
 * Whether a declaration sits inside an augmentation, where it extends a framework
 * or platform type that no Schema can own.
 */
function isAmbient(node: Node): boolean {
  const { parent } = node;
  if (isSourceFile(parent)) {
    return false;
  }
  return isAugmentation(parent) || isAmbient(parent);
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

/** Returns the members that a shape declares itself: an interface's body, or the object literals of a type alias. */
function ownMembers(
  node: InterfaceDeclaration | TypeAliasDeclaration
): readonly TypeElement[] {
  return isInterfaceDeclaration(node)
    ? node.members
    : Arr.flatMap(objectLiterals(node.type), (literal) => literal.members);
}

/**
 * Returns the type parameter names that a node declares for its own children,
 * such as `T` in `<T>(value: T) => T` or in `{ [T in Keys]: T }`.
 */
function declaredNames(node: Node): readonly string[] {
  return Arr.flatMap(children(node), (child) =>
    isTypeParameterDeclaration(child) ? [child.name.text] : []
  );
}

/**
 * Returns the names that `infer` declarations bind inside a type, such as `U`
 * in `Promise<infer U>`.
 */
function inferredNames(node: Node): readonly string[] {
  const own = isInferTypeNode(node) ? [node.typeParameter.name.text] : [];
  return Arr.appendAll(own, Arr.flatMap(children(node), inferredNames));
}

/**
 * Whether a node is a type reference to one of `names`, or contains one that no
 * nearer declaration rebinds. A mapped type or a signature that declares a type
 * parameter of the same name shadows it inside that node, and an `infer` of the
 * same name shadows it in a conditional type's extends clause and true branch.
 */
function mentions(node: Node, names: readonly string[]): boolean {
  if (
    isTypeReferenceNode(node) &&
    isIdentifier(node.typeName) &&
    Arr.contains(names, node.typeName.text)
  ) {
    return true;
  }
  if (isConditionalTypeNode(node)) {
    const trueNames = Arr.difference(names, inferredNames(node.extendsType));
    return (
      mentions(node.checkType, names) ||
      mentions(node.extendsType, trueNames) ||
      mentions(node.trueType, trueNames) ||
      mentions(node.falseType, names)
    );
  }
  const visible = Arr.difference(names, declaredNames(node));
  return Arr.some(children(node), (child) => mentions(child, visible));
}

/**
 * Whether a shape declares type parameters and uses one of them in a member's
 * type, such as `T` in `interface Box<T> { readonly value: T }`. Its Schema
 * takes the parameters as arguments, so no single `typeof X.Type` names it.
 */
function isGeneric(
  node: InterfaceDeclaration | TypeAliasDeclaration,
  members: readonly TypeElement[]
): boolean {
  const parameters = Arr.map(
    node.typeParameters ?? [],
    ({ name }) => name.text
  );
  return Arr.some(members, (member) => mentions(member, parameters));
}

/** Whether the own members of a shape mention the type name `name`. */
function mentionsName(shape: Shape, name: string): boolean {
  return Arr.some(ownMembers(shape), (member) => mentions(member, [name]));
}

/** Returns the module's own shapes that one shape's own members mention. */
function followed(declared: readonly Shape[], shape: Shape): readonly Shape[] {
  return Arr.filter(declared, (candidate) =>
    mentionsName(shape, candidate.name.text)
  );
}

/**
 * Whether the shape `from` reaches the type name `name`, directly or through the
 * shapes that its module declares. Each shape is followed once, as `valueMembers`
 * follows shapes, so a cycle ends the walk. The name itself is matched on the
 * members, so a shape nested in a function still refers to itself.
 */
function reaches(
  declared: readonly Shape[],
  from: Shape,
  name: string,
  seen: readonly string[]
): boolean {
  return (
    mentionsName(from, name) ||
    Arr.some(followed(declared, from), (next) => {
      const target = next.name.text;
      return (
        !Arr.contains(seen, target) &&
        reaches(declared, next, name, Arr.append(seen, target))
      );
    })
  );
}

/**
 * Whether a shape reaches its own name through the shapes of its module, which
 * makes it a recursive type: `Category` in `readonly children:
 * ReadonlyArray<Category>`, or each of `Folder` and `Entry` in a mutually
 * recursive pair. A thunk-named shape that does not reach its own name is plain
 * data, because `typeof X.Type` describes it, and a shape that only leads into a
 * cycle is plain data too.
 */
function reachesItself(declared: readonly Shape[], shape: Shape): boolean {
  return reaches(declared, shape, shape.name.text, [shape.name.text]);
}

/**
 * Returns the hand-written data shapes among one module's `runtime` nodes:
 * interfaces that declare their own members and type aliases that spell out an
 * object, outside the functions that run in the browser page, where no Schema
 * reaches. React component props in `.tsx` modules, ambient augmentations,
 * interfaces that only extend a derived type, the type that a recursive schema
 * names when the type reaches its own name (found among all `nodes`), shapes
 * that hold a value no Schema describes (a function, a React or MDX value, an AI
 * SDK message part, an Effect runtime handle, a parser syntax-tree node), and
 * generic shapes that use a type parameter stay allowed.
 */
export function shapeCandidates(
  file: string,
  sourceFile: SourceFile,
  nodes: readonly Node[],
  runtime: readonly Node[]
) {
  const props = JSX_PATTERN.test(file);
  const recursive = recursiveNames(nodes);
  const declared = Arr.fromIterable(HashMap.values(localShapes(sourceFile)));
  const holdsValue = valueMembers(sourceFile);
  return Arr.flatMap(runtime, (node) => {
    if (!(isInterfaceDeclaration(node) || isTypeAliasDeclaration(node))) {
      return [];
    }
    const members = ownMembers(node);
    const handWritten = isInterfaceDeclaration(node)
      ? !Arr.isReadonlyArrayEmpty(node.members) ||
        node.heritageClauses === undefined
      : !Arr.isReadonlyArrayEmpty(objectLiterals(node.type));
    const allowed =
      (props && PROPS_PATTERN.test(node.name.text)) ||
      isAmbient(node) ||
      (Arr.contains(recursive, node.name.text) &&
        reachesItself(declared, node)) ||
      Arr.some(members, holdsValue) ||
      isGeneric(node, members);
    return handWritten && !allowed
      ? [candidate("data-type", sourceFile, node.name)]
      : [];
  });
}
