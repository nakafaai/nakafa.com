import { Array as Arr, HashSet } from "effect";
import {
  type EntityName,
  type Identifier,
  type ImportClause,
  type InterfaceDeclaration,
  isArrayTypeNode,
  isArrowFunction,
  isCallExpression,
  isConstructorTypeNode,
  isDeclareKeyword,
  isFunctionTypeNode,
  isIdentifier,
  isImportDeclaration,
  isIndexSignatureDeclaration,
  isInterfaceDeclaration,
  isIntersectionTypeNode,
  isLiteralTypeNode,
  isMethodSignatureDeclaration,
  isModuleDeclaration,
  isNamedImports,
  isNamedTupleMember,
  isNamespaceImport,
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

const JSX_PATTERN = /\.tsx$/u;
const PROPS_PATTERN = /Props$/u;
/** The utility types that pick union members with a selector as their second argument. */
const SELECTOR_FILTERS = HashSet.make("Exclude", "Extract");
/** The Schema types whose type argument a recursive `Schema.suspend` thunk returns. */
const RECURSIVE_CODECS = HashSet.make("Codec", "Schema");
/** The modules whose types describe React and MDX values, which no Schema describes as data. */
const FRAMEWORK_TYPE_MODULES = HashSet.make("mdx/types", "react");

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
 * Returns the object literal types that a type spells out, directly or through
 * a union, intersection, array, tuple, `readonly`, or a type argument such as
 * `Readonly<{ ... }>`. The selector that `Extract` or `Exclude` takes as its
 * second argument is skipped, because it picks union members and declares no
 * shape.
 */
function objectLiterals(type: TypeNode): readonly TypeLiteralNode[] {
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

/** Returns the local names that one import clause binds, such as `React` in `import type * as React from "react"`. */
function clauseNames(clause: ImportClause | undefined): readonly string[] {
  const bindings = clause?.namedBindings;
  const named =
    bindings !== undefined && isNamedImports(bindings)
      ? Arr.map(bindings.elements, ({ name }) => name.text)
      : [];
  const namespace =
    bindings !== undefined && isNamespaceImport(bindings)
      ? [bindings.name.text]
      : [];
  return [...Arr.fromNullishOr(clause?.name?.text), ...named, ...namespace];
}

/**
 * Returns the local names that a module binds through its imports from React
 * and MDX, type-only imports included, such as `ReactNode`, `JSX`, and
 * `MDXComponents`.
 */
function frameworkNames(sourceFile: SourceFile) {
  return Arr.flatMap(sourceFile.statements, (statement) => {
    if (
      !(
        isImportDeclaration(statement) &&
        isStringLiteral(statement.moduleSpecifier) &&
        HashSet.has(FRAMEWORK_TYPE_MODULES, statement.moduleSpecifier.text)
      )
    ) {
      return [];
    }
    return clauseNames(statement.importClause);
  });
}

/** Returns the identifier that begins a type name, such as `JSX` in `JSX.Element`. */
function leading(name: EntityName): Identifier {
  return isQualifiedName(name) ? leading(name.left) : name;
}

/**
 * Whether a member type holds a function, a constructor, or a React or MDX
 * value, directly or inside a union, an array, or a readonly array. A name
 * that the file does not import from React or MDX, such as a local alias, is
 * not followed.
 */
function holdsValue(type: TypeNode, names: readonly string[]): boolean {
  if (isParenthesizedTypeNode(type)) {
    return holdsValue(type.type, names);
  }
  if (isUnionTypeNode(type)) {
    return Arr.some(type.types, (member) => holdsValue(member, names));
  }
  if (isArrayTypeNode(type)) {
    return holdsValue(type.elementType, names);
  }
  if (
    isTypeOperatorNode(type) &&
    type.operator === SyntaxKind.ReadonlyKeyword
  ) {
    return holdsValue(type.type, names);
  }
  if (isFunctionTypeNode(type) || isConstructorTypeNode(type)) {
    return true;
  }
  return (
    isTypeReferenceNode(type) &&
    Arr.contains(names, leading(type.typeName).text)
  );
}

/**
 * Whether one member of a shape holds a function, a constructor, or a React or
 * MDX value, or is a method signature. An index signature counts by its value
 * type, and call and construct signatures do not count. A Schema describes data
 * only, so such a member keeps its shape out of Schema candidates.
 */
function holdsValueMember(
  member: TypeElement,
  names: readonly string[]
): boolean {
  if (
    isPropertySignatureDeclaration(member) ||
    isIndexSignatureDeclaration(member)
  ) {
    return member.type !== undefined && holdsValue(member.type, names);
  }
  return isMethodSignatureDeclaration(member);
}

/** Returns the members that a shape declares itself: an interface's body, or the object literals of a type alias. */
function ownMembers(
  node: InterfaceDeclaration | TypeAliasDeclaration
): readonly TypeElement[] {
  return isInterfaceDeclaration(node)
    ? node.members
    : Arr.flatMap(objectLiterals(node.type), (literal) => literal.members);
}

/** Whether a node is a type reference to one of `names`, or contains one. */
function mentions(node: Node, names: readonly string[]): boolean {
  return (
    (isTypeReferenceNode(node) &&
      isIdentifier(node.typeName) &&
      Arr.contains(names, node.typeName.text)) ||
    Arr.some(children(node), (child) => mentions(child, names))
  );
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

/**
 * Returns the hand-written data shapes among one module's `runtime` nodes:
 * interfaces that declare their own members and type aliases that spell out an
 * object, outside the functions that run in the browser page, where no Schema
 * reaches. React component props in `.tsx` modules, ambient augmentations,
 * interfaces that only extend a derived type, the type a recursive schema names
 * (found among all `nodes`), shapes that hold a function or a React or MDX
 * value, and generic shapes that use a type parameter stay allowed.
 */
export function shapeCandidates(
  file: string,
  sourceFile: SourceFile,
  nodes: readonly Node[],
  runtime: readonly Node[]
) {
  const props = JSX_PATTERN.test(file);
  const recursive = recursiveNames(nodes);
  const names = frameworkNames(sourceFile);
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
      Arr.contains(recursive, node.name.text) ||
      Arr.some(members, (member) => holdsValueMember(member, names)) ||
      isGeneric(node, members);
    return handWritten && !allowed
      ? [candidate("data-type", sourceFile, node.name)]
      : [];
  });
}
