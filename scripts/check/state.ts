import { Array as Arr, String as Str } from "effect";
import {
  type Expression,
  isCallExpression,
  isIdentifier,
  isPropertyAccessExpression,
  isVariableStatement,
  type SourceFile,
  type VariableStatement,
} from "typescript/unstable/ast";
import { candidate } from "#scripts/check/rules";

/** Whether an initializer makes one of Effect's mutable values, such as `MutableHashMap.empty()`. */
function makesMutable(initializer: Expression | undefined) {
  return (
    initializer !== undefined &&
    isCallExpression(initializer) &&
    isPropertyAccessExpression(initializer.expression) &&
    isIdentifier(initializer.expression.expression) &&
    Str.startsWith("Mutable")(initializer.expression.expression.text)
  );
}

/** Whether one top-level statement binds a value that a later call can see changed. */
function holdsState(sourceFile: SourceFile) {
  return ({ declarationList }: VariableStatement) =>
    !Str.startsWith("const")(declarationList.getText(sourceFile)) ||
    Arr.some(declarationList.declarations, ({ initializer }) =>
      makesMutable(initializer)
    );
}

/**
 * Describes one candidate per top-level binding that holds state. Convex keeps a
 * module's context between calls (ADR 0040), so such a binding would carry what
 * one caller wrote into the next caller's call.
 */
export function stateCandidates(sourceFile: SourceFile) {
  return Arr.map(
    Arr.filter(
      Arr.filter(sourceFile.statements, isVariableStatement),
      holdsState(sourceFile)
    ),
    (statement) => candidate("module-state", sourceFile, statement)
  );
}
