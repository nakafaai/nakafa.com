import { Schema } from "effect";

const DIGIT_PATTERN = /\d/;
const EXPONENT_SEPARATOR_PATTERN = /[eE]/;
const PLAIN_INTEGER_LITERAL_PATTERN = /^[+-]?\d+(?:\.0*)?$/;
const SIGN_PREFIX_PATTERN = /^[+-]/;
const LEADING_ZERO_PATTERN = /^0+/;
const ZERO_MANTISSA_PATTERN = /^[0.]+$/;
const MAX_DECIMAL_LITERAL_SIGNIFICANT_DIGITS = 16;

const ExactNumericValue = Schema.Struct({
  isExactZero: Schema.Boolean,
  isUnderflow: Schema.Boolean,
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

  return finiteComputedValue(left.value * right.value);
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

  return finiteComputedValue(left.value / right.value);
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

/** Accepts finite nonzero computed values and marks lost nonzero values.
 */
function finiteComputedValue(value: number) {
  if (!Number.isFinite(value)) {
    return;
  }

  return value === 0 ? underflowValue() : finiteNumericValue(value);
}

/** Builds a finite nonzero exact numeric value.
 */
export function finiteNumericValue(value: number): ExactNumericValue {
  return { isExactZero: false, isUnderflow: false, value };
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
