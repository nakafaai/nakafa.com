import {
  Array as Arr,
  HashMap,
  HashSet,
  Option,
  Record as Rec,
  Result,
  String as Str,
} from "effect";
import {
  type BindingElement,
  type Identifier,
  isBindingElement,
  isCallExpression,
  isFunctionDeclaration,
  isIdentifier,
  isImportDeclaration,
  isJsxAttribute,
  isJsxExpression,
  isJsxOpeningElement,
  isJsxSelfClosingElement,
  isNamespaceImport,
  isObjectBindingPattern,
  isParameterDeclaration,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isStringLiteral,
  isVariableDeclaration,
  isVariableStatement,
  type NamedImportBindings,
  type Node,
  type ParameterDeclaration,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { COMPONENT_SET_DIRECTORIES } from "#scripts/check/exports";
import { renderDeclaration } from "#scripts/check/react";
import { children } from "#scripts/check/source";

const JSX_MODULE_PATTERN = /\.tsx$/u;
/** A lowercase tag is an intrinsic element, which React renders itself. */
const INTRINSIC_PATTERN = /^[a-z]/u;
/**
 * A context or a provider component, named so by convention, which shares the
 * value it receives with every reader below it.
 */
const PROVIDER_PATTERN = /(?:Context|Provider)$/u;
/** The specifier prefix of a module of the same app; every other specifier names a package. */
const APP_SPECIFIER_PREFIX = "@/";
/** The prop that holds what a caller composed, which a component places rather than drills. */
const COMPOSED_PROP = "children";
/** The attribute React reads itself, so a value given as a key is consumed. */
const KEY_ATTRIBUTE = "key";

/** Returns the names that a namespace import or named imports bind. */
function boundNames(bindings: NamedImportBindings | undefined) {
  if (bindings === undefined) {
    return [];
  }
  return isNamespaceImport(bindings)
    ? [bindings.name]
    : Arr.map(bindings.elements, (element) => element.name);
}

/** Returns the variables a module declares at its top level with their initializers. */
function topVariables(sourceFile: SourceFile) {
  return Arr.flatMap(sourceFile.statements, (statement) =>
    isVariableStatement(statement)
      ? Arr.filterMap(statement.declarationList.declarations, (declaration) =>
          isIdentifier(declaration.name) &&
          declaration.initializer !== undefined
            ? Result.succeed({
                initializer: declaration.initializer,
                name: declaration.name.text,
              })
            : Result.failVoid
        )
      : []
  );
}

/** Returns the name of a call's callee, such as `createContext` in `React.createContext(...)`. */
function calleeName(node: Node) {
  if (!isCallExpression(node)) {
    return;
  }
  const callee = node.expression;
  if (isPropertyAccessExpression(callee)) {
    return callee.name.text;
  }
  return isIdentifier(callee) ? callee.text : undefined;
}

/** Returns the specifier of the module that a dynamic `import("...")` below a node loads. */
function dynamicSpecifier(node: Node) {
  return Arr.findFirst(nodesBelow(node), (child) =>
    isCallExpression(child) &&
    child.expression.kind === SyntaxKind.ImportKeyword &&
    child.arguments[0] !== undefined &&
    isStringLiteral(child.arguments[0])
      ? Option.some(child.arguments[0].text)
      : Option.none()
  );
}

/**
 * Returns the specifier that each imported name of a module loads, by local
 * name. A component that `lazy(() => import("..."))` loads is an import of
 * that module too.
 */
function importSpecifiers(sourceFile: SourceFile) {
  const imported = Arr.flatMap(sourceFile.statements, (statement) => {
    if (
      !(
        isImportDeclaration(statement) &&
        isStringLiteral(statement.moduleSpecifier) &&
        statement.importClause !== undefined
      )
    ) {
      return [];
    }
    const specifier = statement.moduleSpecifier.text;
    const { name, namedBindings } = statement.importClause;
    const bound = boundNames(namedBindings);
    return Arr.map(
      name === undefined ? bound : Arr.prepend(bound, name),
      (local) => [local.text, specifier] as const
    );
  });
  const loaded = Arr.flatMap(
    topVariables(sourceFile),
    ({ initializer, name }) =>
      calleeName(initializer) === "lazy"
        ? Arr.fromOption(
            Option.map(
              dynamicSpecifier(initializer),
              (specifier) => [name, specifier] as const
            )
          )
        : []
  );
  return HashMap.fromIterable(Arr.appendAll(imported, loaded));
}

/** Returns the names a module binds to `createContext(...)` at its top level. */
function contextNames(sourceFile: SourceFile) {
  return HashSet.fromIterable(
    Arr.filterMap(topVariables(sourceFile), ({ initializer, name }) =>
      calleeName(initializer) === "createContext"
        ? Result.succeed(name)
        : Result.failVoid
    )
  );
}

/** Returns the text of an element's tag, such as `Card.Header`, or undefined for `this` and namespaced tags. */
function tagText(node: Node): string | undefined {
  if (isIdentifier(node)) {
    return node.text;
  }
  if (!isPropertyAccessExpression(node)) {
    return;
  }
  const owner = tagText(node.expression);
  return owner === undefined ? undefined : `${owner}.${node.name.text}`;
}

/** Returns every node below one node, in source order. */
function nodesBelow(node: Node): readonly Node[] {
  return Arr.flatMap(children(node), (child) =>
    Arr.prepend(nodesBelow(child), child)
  );
}

/**
 * Returns each attribute value of the elements among some nodes, with the tag
 * of its element. A key is left out, because React reads it itself.
 */
function attributeValues(nodes: readonly Node[]) {
  return Arr.flatMap(nodes, (node) =>
    isJsxOpeningElement(node) || isJsxSelfClosingElement(node)
      ? Arr.filterMap(node.attributes.properties, (attribute) =>
          isJsxAttribute(attribute) &&
          !(
            isIdentifier(attribute.name) &&
            attribute.name.text === KEY_ATTRIBUTE
          ) &&
          attribute.initializer !== undefined &&
          isJsxExpression(attribute.initializer) &&
          attribute.initializer.expression !== undefined
            ? Result.succeed({
                tag: tagText(node.tagName),
                value: attribute.initializer.expression,
              })
            : Result.failVoid
        )
      : []
  );
}

/** Whether an identifier names a declaration, which binds a name again instead of reading it. */
function declaresName(node: Identifier) {
  const { parent } = node;
  return (
    (isVariableDeclaration(parent) ||
      isParameterDeclaration(parent) ||
      isBindingElement(parent) ||
      isFunctionDeclaration(parent)) &&
    parent.name === node
  );
}

/** Whether an identifier is a key, an attribute name, or a member name, which reads no binding. */
function namesMember(node: Identifier) {
  const { parent } = node;
  return (
    ((isJsxAttribute(parent) ||
      isPropertyAccessExpression(parent) ||
      isPropertyAssignment(parent)) &&
      parent.name === node) ||
    (isBindingElement(parent) && parent.propertyName === node)
  );
}

/** Returns the references to `local` among a body's nodes, or none when a declaration there binds the name again. */
function referencesIn(nodes: readonly Node[], local: string) {
  const names = Arr.filter(
    nodes,
    (node): node is Identifier => isIdentifier(node) && node.text === local
  );
  return Arr.some(names, declaresName)
    ? []
    : Arr.filter(names, (name) => !namesMember(name));
}

/** The name a caller gives a destructured prop: its key, or its local name when it has none. */
function propName(element: BindingElement, local: string) {
  const key = element.propertyName;
  return key !== undefined && (isIdentifier(key) || isStringLiteral(key))
    ? key.text
    : local;
}

/**
 * Returns each prop a component takes with the nodes that read it: the
 * references to each destructured prop, or the member reads such as
 * `props.label` of a props object that the component reads only by member. A
 * props object handed on whole is a wrapper's spread, which this rule leaves
 * to review, and so is a rest element.
 */
function propReads(
  parameter: ParameterDeclaration,
  nodes: readonly Node[]
): readonly (readonly [string, readonly Node[]])[] {
  const binding = parameter.name;
  if (isObjectBindingPattern(binding)) {
    return Arr.filterMap(binding.elements, (element) =>
      element.dotDotDotToken === undefined &&
      element.name !== undefined &&
      isIdentifier(element.name)
        ? Result.succeed([
            propName(element, element.name.text),
            referencesIn(nodes, element.name.text),
          ] as const)
        : Result.failVoid
    );
  }
  if (!isIdentifier(binding)) {
    return [];
  }
  const references = referencesIn(nodes, binding.text);
  const members = Arr.filterMap(references, (reference) =>
    isPropertyAccessExpression(reference.parent)
      ? Result.succeed(reference.parent)
      : Result.failVoid
  );
  return members.length === references.length
    ? Rec.toEntries(Arr.groupBy(members, (member) => member.name.text))
    : [];
}

/**
 * Reports props drilling: a component that receives a prop and only passes
 * it on, unchanged, as an attribute of components of its own module or app,
 * without reading it. The component that reads the value takes it from a
 * context or a store its provider creates, or the caller composes that
 * component as children. A prop counts as read when the component uses it in
 * code, renders it, gives it to an intrinsic element, or gives it to a
 * primitive: a context or provider, or a component of a package or a dependency,
 * whose interface is how its users give it values. `children` holds what the
 * caller composed and a key is read by React, so neither is drilled. The
 * component sets that a registry ships are primitives themselves and keep
 * their upstream shape.
 */
export function inspectDrillingSource(file: string, sourceFile: SourceFile) {
  if (
    !JSX_MODULE_PATTERN.test(file) ||
    Arr.some(COMPONENT_SET_DIRECTORIES, (directory) =>
      file.startsWith(directory)
    )
  ) {
    return [];
  }
  const imports = importSpecifiers(sourceFile);
  const contexts = contextNames(sourceFile);
  /** Whether a tag names a component of this module or app rather than a primitive. */
  const isComposite = (tag: string) => {
    const owner = Arr.headNonEmpty(Str.split(tag, "."));
    if (
      INTRINSIC_PATTERN.test(tag) ||
      PROVIDER_PATTERN.test(tag) ||
      HashSet.has(contexts, owner)
    ) {
      return false;
    }
    return Option.match(HashMap.get(imports, owner), {
      onNone: () => true,
      onSome: (specifier) => specifier.startsWith(APP_SPECIFIER_PREFIX),
    });
  };
  /** Returns the violations of one component: each prop it only drills. */
  const drilled = (node: Node) => {
    const declaration = renderDeclaration(node);
    const parameter = declaration?.fn.parameters[0];
    const body = declaration?.fn.body;
    if (
      declaration === undefined ||
      parameter === undefined ||
      body === undefined
    ) {
      return [];
    }
    const nodes = nodesBelow(body);
    const values = attributeValues(nodes);
    return Arr.filterMap(propReads(parameter, nodes), ([prop, reads]) => {
      const targets = Arr.map(reads, (read) =>
        Option.getOrUndefined(
          Option.flatMapNullishOr(
            Arr.findFirst(values, ({ value }) => value === read),
            ({ tag }) => tag
          )
        )
      );
      const tags = Arr.filter(
        targets,
        (tag): tag is string => tag !== undefined && isComposite(tag)
      );
      return prop === COMPOSED_PROP ||
        Arr.isReadonlyArrayEmpty(tags) ||
        tags.length < targets.length
        ? Result.failVoid
        : Result.succeed(
            `${file}: ${declaration.name} receives ${prop} only to pass it to ${Arr.join(Arr.dedupe(tags), " and ")}. Let the component that reads it take it from a context or a store its provider creates, or compose that component as children, instead of drilling the prop.`
          );
    });
  };
  return Arr.flatMap(sourceFile.statements, (statement) =>
    isVariableStatement(statement)
      ? Arr.flatMap(statement.declarationList.declarations, drilled)
      : drilled(statement)
  );
}
