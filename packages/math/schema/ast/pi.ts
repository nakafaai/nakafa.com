import { readExactNumericExpression } from "@repo/math/schema/coordinate/numeric";

const PI_TOKEN_PATTERN = /π|pi/gi;
const SIGN_PREFIX_PATTERN = /^[+-]/;

/**
 * Reads a syntactic finite multiple of pi from the exact scalar grammar.
 */
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

/**
 * Returns true only for exact integer multiples tracked syntactically.
 */
export function isSyntacticIntegerPiMultiple(multiple: number | undefined) {
  return multiple !== undefined && Number.isInteger(multiple);
}

/**
 * Returns true only for exact half-integer multiples tracked syntactically.
 */
export function isSyntacticHalfIntegerPiMultiple(multiple: number | undefined) {
  return multiple !== undefined && Number.isInteger(multiple - 0.5);
}

/**
 * Carries syntactic pi multiples through unary negation.
 */
export function readNegatedPiMultiple(multiple: number | undefined) {
  return multiple === undefined ? undefined : -multiple;
}

/**
 * Carries syntactic pi multiples through absolute value.
 */
export function readAbsolutePiMultiple(multiple: number | undefined) {
  return multiple === undefined ? undefined : Math.abs(multiple);
}

/**
 * Carries syntactic pi multiples through addition and subtraction.
 */
export function readCombinedPiMultiple(
  left: number | undefined,
  right: number | undefined,
  operator: "add" | "subtract"
) {
  if (left === undefined || right === undefined) {
    return;
  }

  return combineFinitePiMultiples(left, right, operator);
}

/**
 * Carries one syntactic pi factor through multiplication by a numeric scalar.
 */
export function readProductPiMultiple(
  left: { readonly piMultiple?: number; readonly value: number },
  right: { readonly piMultiple?: number; readonly value: number }
) {
  if (left.piMultiple !== undefined && right.piMultiple === undefined) {
    return multiplyFiniteDecimalNumbers(left.piMultiple, right.value);
  }

  if (right.piMultiple !== undefined && left.piMultiple === undefined) {
    return multiplyFiniteDecimalNumbers(right.piMultiple, left.value);
  }
}

/**
 * Carries a syntactic pi numerator through division by a numeric scalar.
 */
export function readQuotientPiMultiple(
  left: { readonly piMultiple?: number; readonly value: number },
  right: { readonly piMultiple?: number; readonly value: number }
) {
  return left.piMultiple === undefined || right.piMultiple !== undefined
    ? undefined
    : left.piMultiple / right.value;
}

/** Multiplies finite decimal string forms to avoid reciprocal-scale drift.
 */
function multiplyFiniteDecimalNumbers(left: number, right: number) {
  const leftDecimal = readFiniteNumberDecimal(left);
  const rightDecimal = readFiniteNumberDecimal(right);

  if (!(leftDecimal && rightDecimal)) {
    return left * right;
  }

  const coefficient = leftDecimal.coefficient * rightDecimal.coefficient;
  const exponent = leftDecimal.exponent + rightDecimal.exponent;
  return readFiniteDecimalValue(coefficient, exponent) ?? left * right;
}

/** Combines finite pi multiples without losing nonzero fractional offsets.
 */
function combineFinitePiMultiples(
  left: number,
  right: number,
  operator: "add" | "subtract"
) {
  const value = operator === "add" ? left + right : left - right;
  if (!Number.isFinite(value)) {
    return;
  }

  if (left === 0 || right === 0) {
    return value;
  }

  if (operator === "add" && (value === left || value === right)) {
    return;
  }

  if (operator === "subtract" && (value === left || value === -right)) {
    return;
  }

  return value;
}

/** Reads the finite number's shortest decimal form as coefficient and exponent.
 */
function readFiniteNumberDecimal(value: number) {
  if (!Number.isFinite(value)) {
    return;
  }

  const text = value.toString();
  const exponentIndex = text.indexOf("e");
  const mantissa = exponentIndex === -1 ? text : text.slice(0, exponentIndex);
  const exponent =
    exponentIndex === -1 ? 0 : Number(text.slice(exponentIndex + 1));
  const unsigned = mantissa.replace(SIGN_PREFIX_PATTERN, "");
  const decimalIndex = unsigned.indexOf(".");
  const decimalPlaces =
    decimalIndex === -1 ? 0 : unsigned.length - decimalIndex - 1;
  const digits = unsigned.replace(".", "");
  const sign = mantissa.startsWith("-") ? "-" : "";

  return {
    coefficient: BigInt(`${sign}${digits}`),
    exponent: exponent - decimalPlaces,
  };
}

/** Converts decimal coefficient/exponent parts back to a finite number.
 */
function readFiniteDecimalValue(coefficient: bigint, exponent: number) {
  const value = Number(`${coefficient}e${exponent}`);
  if (!Number.isFinite(value)) {
    return;
  }

  if (coefficient !== 0n && value === 0) {
    return;
  }

  return value;
}
