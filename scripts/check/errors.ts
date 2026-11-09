import { Array as Arr, HashSet, Option } from "effect";
import {
  type Identifier,
  isCallExpression,
  isIdentifier,
  isNewExpression,
  isThrowStatement,
  type Node,
  type SourceFile,
  type ThrowStatement,
} from "tsrs/ast";
import { candidate } from "#scripts/check/rules";
import { unwrapped } from "#scripts/check/wrapper";

/** The platform's untyped error constructors, which a thrown failure replaces with a tagged error. */
const PLATFORM_ERRORS = HashSet.make(
  "AggregateError",
  "Error",
  "EvalError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "TypeError",
  "URIError"
);

/**
 * The constructor that a throw statement builds a platform error with, as
 * `new Error(...)` or `Error(...)`, or nothing for any other operand.
 */
function platformError(node: ThrowStatement): Option.Option<Identifier> {
  const thrown = unwrapped(node.expression);
  const callee =
    isNewExpression(thrown) || isCallExpression(thrown)
      ? thrown.expression
      : undefined;
  return callee !== undefined &&
    isIdentifier(callee) &&
    HashSet.has(PLATFORM_ERRORS, callee.text)
    ? Option.some(callee)
    : Option.none();
}

/**
 * Describes one `raw-error` candidate per throw statement among the runtime
 * nodes that builds a platform error. It counts only while the constructor is
 * the global one, so a module that declares its own `Error` is not judged.
 */
export function errorCandidates(
  sourceFile: SourceFile,
  runtime: readonly Node[]
) {
  return Arr.flatMap(Arr.filter(runtime, isThrowStatement), (node) =>
    Arr.map(Option.toArray(platformError(node)), (callee) =>
      candidate("raw-error", sourceFile, node, callee)
    )
  );
}
