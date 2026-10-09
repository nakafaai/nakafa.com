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
 * React and MDX values, the design system's Markdown types (each one names a
 * React or MDX type), the scene objects and math classes of three.js, and the
 * parser syntax-tree nodes of ESTree, its JSX extension, and TypeScript. The
 * AI SDK names only some of its types as values, listed below.
 */
const FRAMEWORK_TYPE_MODULES = HashSet.make(
  "@repo/design-system/types/markdown",
  "estree",
  "estree-jsx",
  "mdx/types",
  "react",
  "three",
  "typescript",
  "typescript/unstable/ast"
);

/**
 * The AI SDK types that hold a value no Schema describes: the UI and model
 * message parts, and the tool and schema types that hold functions. The other
 * AI SDK types, such as `JSONValue` and `ChatStatus`, are plain data.
 */
const AI_VALUE_TYPES = HashSet.make(
  "DynamicToolUIPart",
  "FileUIPart",
  "Schema",
  "StepStartUIPart",
  "TextUIPart",
  "Tool",
  "ToolCallRepairFunction",
  "ToolLoopAgentSettings",
  "ToolResultPart",
  "ToolUIPart"
);

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

/**
 * The platform and framework types that a module names without an import and
 * that hold a value no Schema describes: a pending result, a request or a
 * response and its options, a stream, a DOM node, and the route props that
 * Next.js declares globally. A module that binds one of these names itself
 * means its own type.
 */
const PLATFORM_VALUE_TYPES = HashSet.make(
  "AbortSignal",
  "Element",
  "HTMLElement",
  "JSX",
  "LayoutProps",
  "PageProps",
  "Promise",
  "PromiseLike",
  "React",
  "ReadableStream",
  "Request",
  "RequestInit",
  "Response",
  "ResponseInit",
  "RouteContext"
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
 * Returns the local names of the AI SDK types that hold a value, such as
 * `TextUIPart` in `import { type TextUIPart } from "ai"`.
 */
function aiValueNames(clause: ImportClause | undefined): readonly string[] {
  const bindings = clause?.namedBindings;
  return bindings !== undefined && isNamedImports(bindings)
    ? Arr.flatMap(bindings.elements, ({ name, propertyName }) =>
        HashSet.has(AI_VALUE_TYPES, (propertyName ?? name).text)
          ? [name.text]
          : []
      )
    : [];
}

/** Returns the local names that a namespace import of `module` binds, such as `Whole` in `import * as Whole from "effect"`. */
function namespaceNames(
  sourceFile: SourceFile,
  module: string
): readonly string[] {
  return Arr.flatMap(sourceFile.statements, (statement) => {
    if (
      !(
        isImportDeclaration(statement) &&
        isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === module
      )
    ) {
      return [];
    }
    const bindings = statement.importClause?.namedBindings;
    return bindings !== undefined && isNamespaceImport(bindings)
      ? [bindings.name.text]
      : [];
  });
}

/** Returns the identifiers of a type name from left to right, such as `Whole`, `Effect`, and `Effect` in `Whole.Effect.Effect`. */
function segmentsOf(name: EntityName): readonly Identifier[] {
  return isQualifiedName(name)
    ? Arr.append(segmentsOf(name.left), name.right)
    : [name];
}

/**
 * Whether a qualified type name reads one of `members` through a namespace
 * import, such as `Whole.Effect.Effect` for `import * as Whole from "effect"`, or
 * `AI.TextUIPart` for `import type * as AI from "ai"`.
 */
function namesMember(
  name: EntityName,
  namespaces: readonly string[],
  members: HashSet.HashSet<string>
): boolean {
  const [namespace, member] = segmentsOf(name);
  return (
    namespace !== undefined &&
    member !== undefined &&
    Arr.contains(namespaces, namespace.text) &&
    HashSet.has(members, member.text)
  );
}

/**
 * Returns the local names that a module binds to value types through its
 * imports, type-only imports included: everything from React, MDX, the design
 * system's Markdown types, the AI SDK's value types, and ESTree, such as `ReactNode`,
 * `MDXComponents`, `TextUIPart`, and `JSXElement`, and the handle modules of
 * `effect`, such as `Effect` and `Fiber`.
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
    if (module === "ai") {
      return aiValueNames(statement.importClause);
    }
    return module === "effect" ? handleNames(statement.importClause) : [];
  });
}

/**
 * Returns the names that a module binds itself: every name its imports bind,
 * and every interface and type alias it declares at its top level.
 */
function boundNames(sourceFile: SourceFile): readonly string[] {
  return Arr.flatMap(sourceFile.statements, (statement) => {
    if (isImportDeclaration(statement)) {
      return clauseNames(statement.importClause);
    }
    return isInterfaceDeclaration(statement) ||
      isTypeAliasDeclaration(statement)
      ? [statement.name.text]
      : [];
  });
}

/** Returns the interfaces and type aliases that a module declares at its top level, by name. */
export function localShapes(sourceFile: SourceFile) {
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
 * MDX value, an AI SDK message part, an Effect runtime handle, or a parser
 * syntax-tree node. A Schema describes data only, so such a member keeps its
 * shape out of Schema candidates.
 *
 * A member type is read through unions, intersections, arrays, `readonly`,
 * indexed access such as `MDXComponents[string]`, nested object literals, type
 * arguments, and the interfaces and type aliases that the same module
 * declares. An index signature counts by its value type, and call and
 * construct signatures do not count. A name that the module imports from
 * anywhere else is not followed.
 */
export function valueMembers(sourceFile: SourceFile) {
  return valueTests(sourceFile).member;
}

/**
 * Returns the test for a whole type of one module, by the rules of
 * `valueMembers`: whether the type holds a value no Schema describes, such as
 * `ResponseInit & { readonly url?: string }`.
 */
export function valueTypes(sourceFile: SourceFile) {
  return valueTests(sourceFile).type;
}

/** Builds the member test and the type test of one module. */
function valueTests(sourceFile: SourceFile) {
  const names = valueNames(sourceFile);
  const bound = boundNames(sourceFile);
  const effectNamespaces = namespaceNames(sourceFile, "effect");
  const aiNamespaces = namespaceNames(sourceFile, "ai");
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
    const first = leading(type.typeName).text;
    return (
      Arr.contains(names, first) ||
      (HashSet.has(PLATFORM_VALUE_TYPES, first) &&
        !Arr.contains(bound, first)) ||
      namesMember(type.typeName, effectNamespaces, EFFECT_HANDLE_MODULES) ||
      namesMember(type.typeName, aiNamespaces, AI_VALUE_TYPES) ||
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

  return {
    member: (member: TypeElement) => memberHolds(member, []),
    type: (type: TypeNode) => typeHolds(type, []),
  };
}
