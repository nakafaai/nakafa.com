const SIGN_PREFIX_PATTERN = /^[+-]/;

/**
 * Multiplies finite decimal string forms while rejecting underflow to zero.
 */
export function multiplyFiniteDecimalNumbers(left: number, right: number) {
  if (!(Number.isFinite(left) && Number.isFinite(right))) {
    return left * right;
  }

  const leftDecimal = readFiniteNumberDecimal(left);
  const rightDecimal = readFiniteNumberDecimal(right);
  const coefficient = leftDecimal.coefficient * rightDecimal.coefficient;
  const exponent = leftDecimal.exponent + rightDecimal.exponent;
  return readFiniteDecimalValue(coefficient, exponent) ?? left * right;
}

/**
 * Divides finite decimal string forms and rejects drift near trig sentinels.
 */
export function divideFiniteDecimalNumbers(left: number, right: number) {
  const value = left / right;
  if (!Number.isFinite(value)) {
    return;
  }

  if (isRoundedPiSentinel(value)) {
    return;
  }

  if (!(Number.isFinite(left) && Number.isFinite(right))) {
    return value;
  }

  const leftDecimal = readFiniteNumberDecimal(left);
  const rightDecimal = readFiniteNumberDecimal(right);
  const exponent = Math.min(leftDecimal.exponent, rightDecimal.exponent);
  const numerator =
    leftDecimal.coefficient * 10n ** BigInt(leftDecimal.exponent - exponent);
  const denominator =
    rightDecimal.coefficient * 10n ** BigInt(rightDecimal.exponent - exponent);

  return Number(numerator) / Number(denominator);
}

/**
 * Adds or subtracts finite decimal string forms without accepting rounded conversions.
 */
export function readFiniteDecimalSum(
  left: number,
  right: number,
  operator: "add" | "subtract"
) {
  if (!(Number.isFinite(left) && Number.isFinite(right))) {
    return;
  }

  const leftDecimal = readFiniteNumberDecimal(left);
  const rightDecimal = readFiniteNumberDecimal(right);
  const exponent = Math.min(leftDecimal.exponent, rightDecimal.exponent);
  const leftCoefficient =
    leftDecimal.coefficient * 10n ** BigInt(leftDecimal.exponent - exponent);
  const rightCoefficient =
    rightDecimal.coefficient * 10n ** BigInt(rightDecimal.exponent - exponent);
  const coefficient =
    operator === "add"
      ? leftCoefficient + rightCoefficient
      : leftCoefficient - rightCoefficient;

  return readFiniteExactDecimalValue(coefficient, exponent);
}

/**
 * Detects rounded values that are too close to exact trig sentinels to trust.
 */
export function isRoundedPiSentinel(value: number) {
  if (Number.isInteger(value) || Number.isInteger(value - 0.5)) {
    return false;
  }

  const nearestHalf = Math.round(value * 2) / 2;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(value)) * 16;
  return Math.abs(value - nearestHalf) <= tolerance;
}

/**
 * Reads a finite number's shortest decimal form as coefficient and exponent.
 */
function readFiniteNumberDecimal(value: number) {
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

/**
 * Converts decimal coefficient/exponent parts back to a finite number.
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

/**
 * Converts decimal parts only when Number preserves the exact decimal value.
 */
function readFiniteExactDecimalValue(coefficient: bigint, exponent: number) {
  const value = readFiniteDecimalValue(coefficient, exponent);
  if (value === undefined) {
    return;
  }

  return hasSameFiniteDecimalValue(value, coefficient, exponent)
    ? value
    : undefined;
}

/**
 * Compares a Number's shortest decimal form against exact decimal parts.
 */
function hasSameFiniteDecimalValue(
  value: number,
  coefficient: bigint,
  exponent: number
) {
  const actual = readFiniteNumberDecimal(value);
  const commonExponent = Math.min(exponent, actual.exponent);
  const expectedCoefficient =
    coefficient * 10n ** BigInt(exponent - commonExponent);
  const actualCoefficient =
    actual.coefficient * 10n ** BigInt(actual.exponent - commonExponent);
  return expectedCoefficient === actualCoefficient;
}
