import { Array as Arr, HashMap, HashSet, Option, Tuple } from "effect";
import {
  type EntityName,
  type Identifier,
  type ImportClause,
  isArrayTypeNode,
  isConstructorTypeNode,
  isFunctionTypeNode,
  isIdentifier,
  isImportDeclaration,
  isIndexedAccessTypeNode,
  isIndexSignatureDeclaration,
  isInterfaceDeclaration,
  isIntersectionTypeNode,
  isMethodSignatureDeclaration,
  isNamedImports,
  isNamespaceImport,
  isParenthesizedTypeNode,
  isPropertySignatureDeclaration,
  isQualifiedName,
  isStringLiteral,
  isTypeAliasDeclaration,
  isTypeLiteralNode,
  isTypeOperatorNode,
  isTypeReferenceNode,
  isUnionTypeNode,
  type SourceFile,
  SyntaxKind,
  type TypeElement,
  type TypeNode,
} from "typescript/unstable/ast";

/**
 * The modules whose types describe values that no Schema describes as data:
 * React and MDX values, and the message parts that the AI SDK owns.
 */
const FRAMEWORK_TYPE_MODULES = HashSet.make("ai", "mdx/types", "react");

/**
 * The Effect modules whose types are runtime handles: a computation, a fiber,
 * a queue, a scope, and their kin. A handle is held, never encoded, so no
 * Schema describes it. The data modules, such as `Option` and `HashMap`, are
 * not listed, because Schema has a constructor for each.
 */
const EFFECT_HANDLE_MODULES = HashSet.make(
  "Channel",
  "Context",
  "Deferred",
  "Effect",
  "Fiber",
  "Layer",
  "ManagedRuntime",
  "PubSub",
  "Queue",
  "Ref",
  "Schedule",
  "Scope",
  "Sink",
  "Stream",
  "SubscriptionRef"
);

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
 * Returns the local names of the handle modules that one import from `effect`
 * binds, such as `Fiber` in `import { type Fiber, Option } from "effect"`.
 */
function handleNames(clause: ImportClause | undefined): readonly string[] {
  const bindings = clause?.namedBindings;
  return bindings !== undefined && isNamedImports(bindings)
    ? Arr.flatMap(bindings.elements, ({ name, propertyName }) =>
        HashSet.has(EFFECT_HANDLE_MODULES, (propertyName ?? name).text)
          ? [name.text]
          : []
      )
    : [];
}

/**
 * Returns the local names that a module binds to value types through its
 * imports, type-only imports included: everything from React, MDX, and the AI
 * SDK, such as `ReactNode`, `MDXComponents`, and `TextUIPart`, and the handle
 * modules of `effect`, such as `Effect` and `Fiber`.
 */
export function valueNames(sourceFile: SourceFile): readonly string[] {
  return Arr.flatMap(sourceFile.statements, (statement) => {
    if (
      !(
        isImportDeclaration(statement) &&
        isStringLiteral(statement.moduleSpecifier)
      )
    ) {
      return [];
    }
    const module = statement.moduleSpecifier.text;
    if (HashSet.has(FRAMEWORK_TYPE_MODULES, module)) {
      return clauseNames(statement.importClause);
    }
    return module === "effect" ? handleNames(statement.importClause) : [];
  });
}

/** Returns the interfaces and type aliases that a module declares at its top level, by name. */
function localShapes(sourceFile: SourceFile) {
  return HashMap.fromIterable(
    Arr.flatMap(sourceFile.statements, (statement) =>
      isInterfaceDeclaration(statement) || isTypeAliasDeclaration(statement)
        ? [Tuple.make(statement.name.text, statement)]
        : []
    )
  );
}

/** Returns the identifier that begins a type name, such as `JSX` in `JSX.Element`. */
function leading(name: EntityName): Identifier {
  return isQualifiedName(name) ? leading(name.left) : name;
}

/**
 * Returns the types that a wrapping form holds: the members of a union or an
 * intersection, the element of an array, the operand of parentheses or of
 * `readonly`, and the object of an indexed access. Any other type holds none.
 */
function wrappedTypes(type: TypeNode): readonly TypeNode[] {
  if (isUnionTypeNode(type) || isIntersectionTypeNode(type)) {
    return type.types;
  }
  if (isParenthesizedTypeNode(type)) {
    return [type.type];
  }
  if (isArrayTypeNode(type)) {
    return [type.elementType];
  }
  if (isIndexedAccessTypeNode(type)) {
    return [type.objectType];
  }
  return isTypeOperatorNode(type) &&
    type.operator === SyntaxKind.ReadonlyKeyword
    ? [type.type]
    : [];
}

/**
 * Returns the test for the members of one module's shapes that hold a value no
 * Schema describes as data: a function, a constructor, a method, a React or
 * MDX value, an AI SDK message part, or an Effect runtime handle. A Schema
 * describes data only, so such a member keeps its shape out of Schema
 * candidates.
 *
 * A member type is read through unions, intersections, arrays, `readonly`,
 * indexed access such as `MDXComponents[string]`, nested object literals, type
 * arguments, and the interfaces and type aliases that the same module
 * declares. An index signature counts by its value type, and call and
 * construct signatures do not count. A name that the module imports from
 * anywhere else is not followed.
 */
export function valueMembers(sourceFile: SourceFile) {
  const names = valueNames(sourceFile);
  const shapes = localShapes(sourceFile);

  /** Whether a shape that this module declares holds a value; a shape already being read does not count again. */
  function shapeHolds(name: string, seen: readonly string[]): boolean {
    if (Arr.contains(seen, name)) {
      return false;
    }
    const following = Arr.append(seen, name);
    return Option.match(HashMap.get(shapes, name), {
      onNone: () => false,
      onSome: (shape) =>
        isInterfaceDeclaration(shape)
          ? Arr.some(shape.members, (member) => memberHolds(member, following))
          : typeHolds(shape.type, following),
    });
  }

  /** Whether a type holds a value, directly or through the forms the module doc lists. */
  function typeHolds(type: TypeNode, seen: readonly string[]): boolean {
    const inner = wrappedTypes(type);
    if (!Arr.isReadonlyArrayEmpty(inner)) {
      return Arr.some(inner, (member) => typeHolds(member, seen));
    }
    if (isTypeLiteralNode(type)) {
      return Arr.some(type.members, (member) => memberHolds(member, seen));
    }
    if (isFunctionTypeNode(type) || isConstructorTypeNode(type)) {
      return true;
    }
    if (!isTypeReferenceNode(type)) {
      return false;
    }
    return (
      Arr.contains(names, leading(type.typeName).text) ||
      Arr.some(type.typeArguments ?? [], (argument) =>
        typeHolds(argument, seen)
      ) ||
      (isIdentifier(type.typeName) && shapeHolds(type.typeName.text, seen))
    );
  }

  /** Whether one member holds a value: by its type, or because it is a method. */
  function memberHolds(member: TypeElement, seen: readonly string[]): boolean {
    if (
      isPropertySignatureDeclaration(member) ||
      isIndexSignatureDeclaration(member)
    ) {
      return member.type !== undefined && typeHolds(member.type, seen);
    }
    return isMethodSignatureDeclaration(member);
  }

  return (member: TypeElement) => memberHolds(member, []);
}
