import { Array as Arr } from "effect";
import {
  type ArrowFunction,
  type BindingName,
  type FunctionExpression,
  type FunctionLikeDeclaration,
  type Identifier,
  isArrowFunction,
  isBindingElement,
  isBlock,
  isCaseBlock,
  isCatchClause,
  isClassDeclaration,
  isClassExpression,
  isEnumDeclaration,
  isForInStatement,
  isForOfStatement,
  isForStatement,
  isFunctionDeclaration,
  isFunctionExpression,
  isFunctionLikeDeclaration,
  isIdentifier,
  isModuleBlock,
  isModuleDeclaration,
  isSourceFile,
  isVariableDeclarationList,
  isVariableStatement,
  type Node,
  type VariableDeclaration,
} from "typescript/unstable/ast";
import { unwrapped } from "#scripts/check/wrapper";

/**
 * What one declaration binds a name to: the function value it holds, or
 * `undefined` when the binding is not a function.
 */
type Declared = Node | undefined;

/** Whether a node is an arrow function or a function expression, the function values a binding can hold. */
export function isFunctionValue(
  node: Node | undefined
): node is ArrowFunction | FunctionExpression {
  return (
    node !== undefined && (isArrowFunction(node) || isFunctionExpression(node))
  );
}

/** Whether a binding name, an identifier or a destructuring pattern, binds `name`. */
function bindsName(binding: BindingName, name: string): boolean {
  return isIdentifier(binding)
    ? binding.text === name
    : Arr.some(
        binding.elements,
        (element) =>
          isBindingElement(element) &&
          element.name !== undefined &&
          bindsName(element.name, name)
      );
}

/** The function value that a variable holds, when it binds an identifier to a function. */
function functionValueOf(declaration: VariableDeclaration): Declared {
  const { initializer } = declaration;
  if (!isIdentifier(declaration.name) || initializer === undefined) {
    return undefined;
  }
  const value = unwrapped(initializer);
  return isFunctionValue(value) ? value : undefined;
}

/** The declarations of one variable list that bind `name`. */
function variableBindings(
  declarations: readonly VariableDeclaration[],
  name: string
): readonly Declared[] {
  return Arr.flatMap(declarations, (declaration) =>
    bindsName(declaration.name, name) ? [functionValueOf(declaration)] : []
  );
}

/** The declarations of one statement list that bind `name`. */
function statementBindings(
  statements: readonly Node[],
  name: string
): readonly Declared[] {
  return Arr.flatMap(statements, (statement): readonly Declared[] => {
    if (isVariableStatement(statement)) {
      return variableBindings(statement.declarationList.declarations, name);
    }
    if (isFunctionDeclaration(statement)) {
      return statement.name?.text === name ? [statement] : [];
    }
    return (isClassDeclaration(statement) ||
      isEnumDeclaration(statement) ||
      isModuleDeclaration(statement)) &&
      statement.name?.text === name
      ? [undefined]
      : [];
  });
}

/**
 * The bindings that a function's own scope holds for `name`: its parameters,
 * and then the name of a function expression, which only its body sees.
 */
function functionBindings(
  scope: FunctionLikeDeclaration,
  name: string
): readonly Declared[] {
  const parameters = Arr.flatMap(scope.parameters, (parameter) =>
    bindsName(parameter.name, name) ? [undefined] : []
  );
  if (!Arr.isReadonlyArrayEmpty(parameters)) {
    return parameters;
  }
  return isFunctionExpression(scope) && scope.name?.text === name
    ? [scope]
    : [];
}

/** The declarations that one scope binds to `name`, none when the scope binds nothing. */
function scopeBindings(scope: Node, name: string): readonly Declared[] {
  if (isSourceFile(scope) || isModuleBlock(scope) || isBlock(scope)) {
    return statementBindings(scope.statements, name);
  }
  if (isCaseBlock(scope)) {
    return statementBindings(
      Arr.flatMap(scope.clauses, (clause) => clause.statements),
      name
    );
  }
  if (isFunctionLikeDeclaration(scope)) {
    return functionBindings(scope, name);
  }
  if (isClassExpression(scope)) {
    return scope.name?.text === name ? [undefined] : [];
  }
  if (
    isForStatement(scope) ||
    isForInStatement(scope) ||
    isForOfStatement(scope)
  ) {
    return scope.initializer !== undefined &&
      isVariableDeclarationList(scope.initializer)
      ? variableBindings(scope.initializer.declarations, name)
      : [];
  }
  if (isCatchClause(scope) && scope.variableDeclaration !== undefined) {
    return bindsName(scope.variableDeclaration.name, name) ? [undefined] : [];
  }
  return [];
}

/** Searches outward from `node` for the first scope that binds `name`, and returns the functions it binds. */
function enclosingFunctions(node: Node, name: string): readonly Node[] {
  const bindings = scopeBindings(node, name);
  if (!Arr.isReadonlyArrayEmpty(bindings)) {
    return Arr.filter(
      bindings,
      (binding): binding is Node => binding !== undefined
    );
  }
  return isSourceFile(node) ? [] : enclosingFunctions(node.parent, name);
}

/**
 * Returns the function values that the innermost declaration of the name of
 * `reference` binds. The search runs outward through each enclosing statement
 * list (a module, a block, a module block, or a case block), each function's
 * parameters and expression name, each class expression's name, each loop
 * head, and each catch clause, and the first scope that binds the name decides.
 * A binding without a function value, such as a parameter, a destructured
 * name, a class, or a variable that a call initializes, binds no function, so
 * an outer function of the same name is not the one the reference names.
 * Hoisted `var` declarations are not searched, because the repository's
 * Ultracite configuration rejects `var` (`noVar`). Imports are not searched
 * either, because a module that imports a name declares no function of that
 * name at its top level.
 */
export function boundFunctions(reference: Identifier): readonly Node[] {
  return enclosingFunctions(reference.parent, reference.text);
}
