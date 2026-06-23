import { readExactNumericExpression } from "@repo/math/schema/coordinate-exact-numeric";

const PI_TOKEN_PATTERN = /π|pi/gi;

interface PiMultipleOperand {
  piMultiple?: number;
  value: number;
}

/** Reads a syntactic finite multiple of pi from the exact scalar grammar. */
export function readSyntacticPiMultiple(expression: string, value: number) {
  const compact = expression.trim().replaceAll(/\s+/g, "");
  const matches = compact.match(PI_TOKEN_PATTERN);
  if (matches?.length === 1) {
    return readExactNumericExpression(compact.replace(PI_TOKEN_PATTERN, "1"));
  }

  return value === 0 && readExactNumericExpression(compact) === 0
    ? 0
    : undefined;
}

/** Returns true only for exact integer multiples tracked syntactically. */
export function isSyntacticIntegerPiMultiple(multiple: number | undefined) {
  return multiple !== undefined && Number.isInteger(multiple);
}

/** Returns true only for exact half-integer multiples tracked syntactically. */
export function isSyntacticHalfIntegerPiMultiple(multiple: number | undefined) {
  return multiple !== undefined && Number.isInteger(multiple - 0.5);
}

/** Carries syntactic pi multiples through unary negation. */
export function readNegatedPiMultiple(multiple: number | undefined) {
  return multiple === undefined ? undefined : -multiple;
}

/** Carries syntactic pi multiples through absolute value. */
export function readAbsolutePiMultiple(multiple: number | undefined) {
  return multiple === undefined ? undefined : Math.abs(multiple);
}

/** Carries syntactic pi multiples through addition and subtraction. */
export function readCombinedPiMultiple(
  left: number | undefined,
  right: number | undefined,
  operator: "add" | "subtract"
) {
  if (left === undefined || right === undefined) {
    return;
  }

  return operator === "add" ? left + right : left - right;
}

/** Carries one syntactic pi factor through multiplication by a numeric scalar. */
export function readProductPiMultiple(
  left: PiMultipleOperand,
  right: PiMultipleOperand
) {
  if (left.piMultiple !== undefined && right.piMultiple === undefined) {
    return left.piMultiple * right.value;
  }

  if (right.piMultiple !== undefined && left.piMultiple === undefined) {
    return right.piMultiple * left.value;
  }
}

/** Carries a syntactic pi numerator through division by a numeric scalar. */
export function readQuotientPiMultiple(
  left: PiMultipleOperand,
  right: PiMultipleOperand
) {
  return left.piMultiple === undefined || right.piMultiple !== undefined
    ? undefined
    : left.piMultiple / right.value;
}
