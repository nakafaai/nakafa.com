import { Array as Arr, HashSet } from "effect";
import {
  type EntityName,
  type Identifier,
  type ImportClause,
  isArrayTypeNode,
  isConstructorTypeNode,
  isFunctionTypeNode,
  isImportDeclaration,
  isIndexSignatureDeclaration,
  isMethodSignatureDeclaration,
  isNamedImports,
  isNamespaceImport,
  isParenthesizedTypeNode,
  isPropertySignatureDeclaration,
  isQualifiedName,
  isStringLiteral,
  isTypeOperatorNode,
  isTypeReferenceNode,
  isUnionTypeNode,
  type SourceFile,
  SyntaxKind,
  type TypeElement,
  type TypeNode,
} from "typescript/unstable/ast";

/** The modules whose types describe React and MDX values, which no Schema describes as data. */
const FRAMEWORK_TYPE_MODULES = HashSet.make("mdx/types", "react");

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
export function frameworkNames(sourceFile: SourceFile): readonly string[] {
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
export function holdsValueMember(
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
