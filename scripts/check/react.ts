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
  isJsxElement,
  isJsxFragment,
  isJsxSelfClosingElement,
  isParenthesizedExpression,
  isPropertyAccessExpression,
  isReturnStatement,
  isVariableDeclaration,
  type Node,
  type SourceFile,
} from "typescript/unstable/ast";

type RenderFunction = ArrowFunction | FunctionDeclaration | FunctionExpression;

const JSX_MODULE_PATTERN = /\.tsx$/u;
/** Wrappers whose callback becomes a component or a render function. */
const FUNCTION_WRAPPERS = new Set(["forwardRef", "memo", "useCallback"]);

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
  const statements: Node[] = [body];
  for (const node of statements) {
    if (isReturnStatement(node) && isJsxValue(node.expression)) {
      return true;
    }
    node.forEachChild((child) => {
      if (!(isFunctionValue(child) || isFunctionDeclaration(child))) {
        statements.push(child);
      }
    });
  }
  return false;
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
  if (name === undefined || !FUNCTION_WRAPPERS.has(name)) {
    return;
  }
  return initializer.arguments.find(isFunctionValue);
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
  const violations: string[] = [];
  const visit = (node: Node, component: string | undefined) => {
    const declaration = renderDeclaration(node);
    if (declaration !== undefined && component !== undefined) {
      violations.push(
        `${file}: declare ${declaration.name} as a named module-level component instead of a function that returns JSX inside ${component}.`
      );
    }
    const owner = component ?? declaration?.name;
    node.forEachChild((child) => {
      visit(child, owner);
    });
  };
  visit(sourceFile, undefined);
  return violations;
}
