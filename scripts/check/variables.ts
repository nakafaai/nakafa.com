import { Array as Arr, Effect, Result } from "effect";
import {
  type BindingElement,
  type Expression,
  isBindingElement,
  isVariableDeclaration,
  type Node,
  type SourceFile,
  type VariableDeclaration,
} from "typescript/unstable/ast";
import { assignmentsTo } from "#scripts/check/assignments";
import type { parseSources } from "#scripts/check/source";

type Declare = Effect.Success<ReturnType<typeof parseSources>>["declare"];
/** A `const`, `let`, or `var`, or a name that a pattern takes out of one. */
type Variable = BindingElement | VariableDeclaration;

/**
 * Whether a declaration is a variable: a `const`, `let`, or `var`, or a name that
 * a pattern takes out of one. A parameter, a function, a class, and a name that a
 * pattern takes out of a parameter are not.
 */
export function isVariable(node: Node): node is Variable {
  return (
    isVariableDeclaration(node) ||
    (isBindingElement(node) && isVariable(node.parent.parent))
  );
}

/**
 * Returns the values a variable is given where it is declared: its initializer,
 * and for a name that a pattern takes out of another variable, the values of
 * that variable and the default the pattern writes for it, as `"flex"` in
 * `const { item = "flex" } = options`.
 */
function declaredValues(variable: Variable): readonly Expression[] {
  const owner = variable.parent.parent;
  return Arr.appendAll(
    isVariable(owner) ? declaredValues(owner) : [],
    Arr.fromNullishOr(variable.initializer)
  );
}

/**
 * Returns, for each variable, every value its module gives it: the values it is
 * declared with, and the value of each later assignment that writes it, as a
 * name, as a name in a destructuring pattern, or as the start of a member. The
 * module is searched for assignments by the name of the variable alone, and the
 * compiler then resolves each one, so an assignment counts only when it writes
 * this variable, and not one of the same name in another scope.
 */
export const variableValues = Effect.fn("RepositoryPolicy.variableValues")(
  function* (
    declare: Declare,
    variables: readonly {
      readonly module: { readonly sourceFile: SourceFile };
      readonly name: string;
      readonly node: Variable;
    }[]
  ) {
    const written = Arr.flatMap(variables, (variable) =>
      Arr.map(
        assignmentsTo(variable.module.sourceFile, variable.name),
        ({ target, value }) => ({ target, value, variable })
      )
    );
    const declarations = yield* declare(
      Arr.map(written, ({ target }) => target)
    );
    const assigned = Arr.filterMap(
      Arr.zip(written, declarations),
      ([{ value, variable }, declaration]) =>
        declaration?.pos === variable.node.pos
          ? Result.succeed({ value, variable })
          : Result.failVoid
    );
    return Arr.map(variables, (variable) =>
      Arr.appendAll(
        declaredValues(variable.node),
        Arr.filterMap(assigned, (assignment) =>
          assignment.variable === variable
            ? Result.succeed(assignment.value)
            : Result.failVoid
        )
      )
    );
  }
);
