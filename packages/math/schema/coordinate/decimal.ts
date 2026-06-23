import {
  divideFiniteDecimalNumbers,
  multiplyFiniteDecimalNumbers,
} from "@repo/math/schema/ast/decimal";
import { Schema } from "effect";

const DIGIT_PATTERN = /\d/;
const DECIMAL_LITERAL_PATTERN =
  /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/;
const EXPONENT_SEPARATOR_PATTERN = /[eE]/;
const PLAIN_INTEGER_LITERAL_PATTERN = /^[+-]?\d+(?:\.0*)?$/;
const SIGN_PREFIX_PATTERN = /^[+-]/;
const LEADING_ZERO_PATTERN = /^0+/;
const ZERO_MANTISSA_PATTERN = /^[0.]+$/;
const MAX_DECIMAL_LITERAL_SIGNIFICANT_DIGITS = 16;

const ExactNumericValue = Schema.Struct({
  isExactZero: Schema.Boolean,
  isUnderflow: Schema.Boolean,
  usesApproximateValue: Schema.optional(Schema.Boolean),
  value: Schema.Number.pipe(Schema.finite()),
});

export type ExactNumericValue = Schema.Schema.Type<typeof ExactNumericValue>;

/** Reads one numeric literal without accepting unsafe rounded metadata.
 */
export function readNumericLiteralValue(literal: string) {
  const parsed = Number(literal);

  if (!Number.isFinite(parsed)) {
    return;
  }

  if (
    PLAIN_INTEGER_LITERAL_PATTERN.test(literal) &&
    !Number.isSafeInteger(parsed)
  ) {
    return;
  }

  if (isUnsafeExactIntegerLiteral(literal, parsed)) {
    return;
  }

  if (hasTooManyDecimalSignificantDigits(literal)) {
    return;
  }

  if (parsed === 0) {
    return isSyntacticZeroLiteral(literal)
      ? exactZeroValue()
      : underflowValue();
  }

  return finiteNumericValue(parsed);
}

/**
 * Rejects exponent or decimal spellings that denote unsafe exact integers.
 */
function isUnsafeExactIntegerLiteral(literal: string, parsed: number) {
  if (!(Number.isInteger(parsed) && !Number.isSafeInteger(parsed))) {
    return false;
  }

  const decimal = readDecimalLiteralParts(literal);
  if (
    decimal &&
    isScaledPowerOfTenLiteral(decimal.coefficient, decimal.scale)
  ) {
    return false;
  }

  return decimal
    ? decimalRepresentsInteger(decimal.coefficient, decimal.scale)
    : true;
}

/**
 * Reads decimal coefficient and base-10 scale without using Number rounding.
 */
function readDecimalLiteralParts(literal: string) {
  const match = DECIMAL_LITERAL_PATTERN.exec(literal);
  if (!match) {
    return;
  }

  const wholeDigits = match[2] ?? "";
  const fractionalDigits = match[3] ?? match[4] ?? "";
  const digits = `${wholeDigits}${fractionalDigits}`;
  const exponent = match[5] ? Number(match[5]) : 0;

  return {
    coefficient: BigInt(digits),
    scale: exponent - fractionalDigits.length,
  };
}

/**
 * Checks whether a decimal coefficient/scale has no fractional remainder.
 */
function decimalRepresentsInteger(coefficient: bigint, scale: number) {
  if (scale >= 0) {
    return true;
  }

  const divisor = 10n ** BigInt(-scale);
  return coefficient % divisor === 0n;
}

/**
 * Allows finite powers of ten used by exact product/quotient guards.
 */
function isScaledPowerOfTenLiteral(coefficient: bigint, scale: number) {
  return scale > 0 && (coefficient === 1n || coefficient === -1n);
}

/** Multiplies two exact numeric values and preserves underflow state.
 */
export function multiplyNumericValue(
  left: ExactNumericValue,
  right: ExactNumericValue
) {
  if (left.isExactZero || right.isExactZero) {
    return exactZeroValue();
  }

  if (left.isUnderflow || right.isUnderflow) {
    return underflowValue();
  }

  if (left.usesApproximateValue || right.usesApproximateValue) {
    return finiteApproximateComputedValue(left.value * right.value);
  }

  const product = multiplyFiniteDecimalNumbers(left.value, right.value);
  return product === undefined ? undefined : finiteNumericValue(product);
}

/** Divides exact numeric values while rejecting zero denominators.
 */
export function divideNumericValue(
  left: ExactNumericValue,
  right: ExactNumericValue
) {
  if (right.isExactZero) {
    return;
  }

  if (left.isExactZero) {
    return exactZeroValue();
  }

  if (left.isUnderflow || right.isUnderflow) {
    return underflowValue();
  }

  if (left.usesApproximateValue || right.usesApproximateValue) {
    return finiteApproximateComputedValue(left.value / right.value);
  }

  const quotient = divideFiniteDecimalNumbers(left.value, right.value);
  return quotient === undefined
    ? finiteApproximateComputedValue(left.value / right.value)
    : finiteNumericValue(quotient);
}

/** Caps decimal metadata precision before Number can round it away.
 */
function hasTooManyDecimalSignificantDigits(literal: string) {
  const unsigned = literal.replace(SIGN_PREFIX_PATTERN, "");
  const exponentIndex = unsigned.search(EXPONENT_SEPARATOR_PATTERN);
  const coefficient =
    exponentIndex === -1 ? unsigned : unsigned.slice(0, exponentIndex);
  if (!(coefficient.includes(".") || unsigned.toLowerCase().includes("e"))) {
    return false;
  }

  const digits = coefficient.replace(".", "");
  const significantDigits = digits.replace(LEADING_ZERO_PATTERN, "");
  return significantDigits.length > MAX_DECIMAL_LITERAL_SIGNIFICANT_DIGITS;
}

/** Builds a finite nonzero exact numeric value.
 */
export function finiteNumericValue(
  value: number,
  options: { readonly usesApproximateValue?: boolean } = {}
): ExactNumericValue {
  return {
    isExactZero: false,
    isUnderflow: false,
    ...(options.usesApproximateValue ? { usesApproximateValue: true } : {}),
    value,
  };
}

/**
 * Keeps finite sortable approximate quotients while rejecting unsafe doubles.
 */
function finiteApproximateComputedValue(value: number) {
  if (!Number.isFinite(value)) {
    return;
  }

  if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
    return;
  }

  return value === 0
    ? underflowValue()
    : finiteNumericValue(value, { usesApproximateValue: true });
}

/** Builds an exact syntactic zero value.
 */
function exactZeroValue(): ExactNumericValue {
  return { isExactZero: true, isUnderflow: false, value: 0 };
}

/** Marks nonzero exact numeric input that collapsed to zero.
 */
function underflowValue(): ExactNumericValue {
  return { isExactZero: false, isUnderflow: true, value: 0 };
}

/** Returns true when a zero parse came from a syntactic zero mantissa.
 */
function isSyntacticZeroLiteral(literal: string) {
  const unsigned = literal.replace(SIGN_PREFIX_PATTERN, "");
  const exponentIndex = unsigned.search(EXPONENT_SEPARATOR_PATTERN);
  const mantissa =
    exponentIndex === -1 ? unsigned : unsigned.slice(0, exponentIndex);

  return DIGIT_PATTERN.test(mantissa) && ZERO_MANTISSA_PATTERN.test(mantissa);
}
