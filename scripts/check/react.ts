import { Array as Arr, HashMap, HashSet, MutableHashMap, Option } from "effect";
import {
  type ArrowFunction,
  type Expression,
  type FunctionDeclaration,
  type FunctionExpression,
  isArrowFunction,
  isBinaryExpression,
  isBlock,
  isCallExpression,
  isConditionalExpression,
  isFunctionDeclaration,
  isFunctionExpression,
  isIdentifier,
  isImportDeclaration,
  isJsxElement,
  isJsxFragment,
  isJsxSelfClosingElement,
  isNamedImports,
  isNamespaceImport,
  isParenthesizedExpression,
  isPropertyAccessExpression,
  isReturnStatement,
  isStringLiteral,
  isVariableDeclaration,
  type Node,
  type SourceFile,
  type Statement,
} from "typescript/unstable/ast";
import { children } from "#scripts/check/source";

type RenderFunction = ArrowFunction | FunctionDeclaration | FunctionExpression;

const JSX_MODULE_PATTERN = /\.tsx$/u;
/** Wrappers whose callback becomes a component or a render function. */
const FUNCTION_WRAPPERS = HashSet.make("forwardRef", "memo", "useCallback");

/** Whether an expression evaluates to JSX, directly or through a branch. */
function isJsxValue(node: Expression | undefined): boolean {
  if (node === undefined) {
    return false;
  }
  if (isParenthesizedExpression(node)) {
    return isJsxValue(node.expression);
  }
  if (isConditionalExpression(node)) {
    return isJsxValue(node.whenTrue) || isJsxValue(node.whenFalse);
  }
  if (isBinaryExpression(node)) {
    return isJsxValue(node.left) || isJsxValue(node.right);
  }
  return (
    isJsxElement(node) || isJsxSelfClosingElement(node) || isJsxFragment(node)
  );
}

/** Whether a node is a function expression or arrow function. */
function isFunctionValue(
  node: Node | undefined
): node is ArrowFunction | FunctionExpression {
  return (
    node !== undefined && (isArrowFunction(node) || isFunctionExpression(node))
  );
}

/** Whether a function returns JSX from its own body, ignoring nested functions. */
function returnsJsx(fn: RenderFunction) {
  const { body } = fn;
  if (body === undefined) {
    return false;
  }
  if (!isBlock(body)) {
    return isJsxValue(body);
  }
  /** Whether a node returns JSX outside the functions nested in it. */
  const returnsValue = (node: Node): boolean =>
    (isReturnStatement(node) && isJsxValue(node.expression)) ||
    Arr.some(
      children(node),
      (child) =>
        !(isFunctionValue(child) || isFunctionDeclaration(child)) &&
        returnsValue(child)
    );
  return returnsValue(body);
}

/** Returns the callee name of a wrapper call such as `memo` or `React.memo`. */
function wrapperName(node: Expression) {
  if (isIdentifier(node)) {
    return node.text;
  }
  return isPropertyAccessExpression(node) ? node.name.text : undefined;
}

/** Returns the function a variable declares, including wrapped callbacks. */
function declaredFunction(initializer: Expression | undefined) {
  if (isFunctionValue(initializer)) {
    return initializer;
  }
  if (initializer === undefined || !isCallExpression(initializer)) {
    return;
  }
  const name = wrapperName(initializer.expression);
  if (name === undefined || !HashSet.has(FUNCTION_WRAPPERS, name)) {
    return;
  }
  return Option.getOrUndefined(
    Arr.findFirst(initializer.arguments, isFunctionValue)
  );
}

/** Returns the name and function of a component-shaped declaration. */
function renderDeclaration(node: Node) {
  if (isFunctionDeclaration(node) && returnsJsx(node)) {
    return { fn: node, name: node.name?.text ?? "an anonymous function" };
  }
  if (!(isVariableDeclaration(node) && isIdentifier(node.name))) {
    return;
  }
  const fn = declaredFunction(node.initializer);
  return fn !== undefined && returnsJsx(fn)
    ? { fn, name: node.name.text }
    : undefined;
}

/**
 * Reports functions that return JSX declared inside a React component. A
 * nested component remounts on every render, and a render helper hides a
 * component boundary from React and from readers; both belong in a named
 * module-level component. Inline callbacks, such as list items or rich-text
 * tags, stay where they are passed.
 */
export function inspectReactSource(file: string, sourceFile: SourceFile) {
  if (!JSX_MODULE_PATTERN.test(file)) {
    return [];
  }
  /** Returns the nested render functions below one node, in source order. */
  const visit = (node: Node, component: string | undefined): string[] => {
    const declaration = renderDeclaration(node);
    const owner = component ?? declaration?.name;
    return Arr.appendAll(
      declaration !== undefined && component !== undefined
        ? [
            `${file}: declare ${declaration.name} as a named module-level component instead of a function that returns JSX inside ${component}.`,
          ]
        : [],
      Arr.flatMap(children(node), (child) => visit(child, owner))
    );
  };
  return visit(sourceFile, undefined);
}

/** Shared-state APIs the codebase does not use, by module, with the rule that replaces each. */
const STATE_APIS = HashMap.fromIterable<
  string,
  HashMap.HashMap<string, string>
>([
  [
    "react",
    HashMap.fromIterable([
      ["useContext", "read contexts with use() instead of React's useContext"],
    ]),
  ],
  [
    "zustand",
    HashMap.fromIterable([
      [
        "create",
        "create Zustand stores per provider with createStore and read them with useStore, instead of a module-level store from create",
      ],
    ]),
  ],
]);

/** A removed state library and the rule that replaces it. */
const REMOVED_STATE_MODULE = "use-context-selector";

const REMOVED_STATE_RULE =
  "import nothing from use-context-selector. Read render values from a React context with use(), and keep state a provider owns in a Zustand store created per provider";

/**
 * Reports one import's replaced state APIs and records the default or
 * namespace name it binds, so property access through it is checked too.
 */
function inspectStateImport(
  file: string,
  statement: Statement,
  namespaces: MutableHashMap.MutableHashMap<
    string,
    HashMap.HashMap<string, string>
  >
) {
  if (
    !(
      isImportDeclaration(statement) &&
      isStringLiteral(statement.moduleSpecifier)
    )
  ) {
    return [];
  }
  if (statement.moduleSpecifier.text === REMOVED_STATE_MODULE) {
    return [`${file}: ${REMOVED_STATE_RULE}.`];
  }
  const apis = Option.getOrUndefined(
    HashMap.get(STATE_APIS, statement.moduleSpecifier.text)
  );
  const clause = statement.importClause;
  if (!(apis && clause)) {
    return [];
  }
  if (clause.name !== undefined) {
    MutableHashMap.set(namespaces, clause.name.text, apis);
  }
  const bindings = clause.namedBindings;
  if (bindings !== undefined && isNamespaceImport(bindings)) {
    MutableHashMap.set(namespaces, bindings.name.text, apis);
  }
  if (!(bindings !== undefined && isNamedImports(bindings))) {
    return [];
  }
  return Arr.flatMap(bindings.elements, (element) => {
    const rule = Option.getOrUndefined(
      HashMap.get(apis, (element.propertyName ?? element.name).text)
    );
    return rule === undefined ? [] : [`${file}: ${rule}.`];
  });
}

/**
 * Reports the shared-state APIs this codebase replaced: any use-context-selector
 * import, React's useContext, and Zustand's module-level create, whether
 * imported by name or reached through a default or namespace import.
 */
export function inspectStateSource(file: string, sourceFile: SourceFile) {
  const namespaces = MutableHashMap.empty<
    string,
    HashMap.HashMap<string, string>
  >();
  const imports = Arr.flatMap(sourceFile.statements, (statement) =>
    inspectStateImport(file, statement, namespaces)
  );
  /** Returns the replaced APIs read through a namespace below one node. */
  const visit = (node: Node): string[] => {
    const rule =
      isPropertyAccessExpression(node) && isIdentifier(node.expression)
        ? Option.getOrUndefined(
            Option.flatMap(
              MutableHashMap.get(namespaces, node.expression.text),
              (apis) => HashMap.get(apis, node.name.text)
            )
          )
        : undefined;
    return Arr.appendAll(
      rule === undefined ? [] : [`${file}: ${rule}.`],
      Arr.flatMap(children(node), visit)
    );
  };
  return Arr.appendAll(imports, visit(sourceFile));
}
