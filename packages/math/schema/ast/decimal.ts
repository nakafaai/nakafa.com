const SIGN_PREFIX_PATTERN = /^[+-]/;

/**
 * Multiplies finite decimal string forms while rejecting underflow to zero.
 */
export function multiplyFiniteDecimalNumbers(left: number, right: number) {
  if (!(Number.isFinite(left) && Number.isFinite(right))) {
    return;
  }

  const leftDecimal = readFiniteNumberDecimal(left);
  const rightDecimal = readFiniteNumberDecimal(right);
  const coefficient = leftDecimal.coefficient * rightDecimal.coefficient;
  const exponent = leftDecimal.exponent + rightDecimal.exponent;
  return readFiniteExactDecimalValue(coefficient, exponent);
}

/**
 * Divides finite decimal string forms and rejects drift near trig sentinels.
 */
export function divideFiniteDecimalNumbers(left: number, right: number) {
  if (!(Number.isFinite(left) && Number.isFinite(right)) || right === 0) {
    return;
  }

  const quotient = readFiniteDecimalQuotient(left, right);
  if (quotient === undefined || isRoundedPiSentinel(quotient)) {
    return;
  }

  return quotient;
}

/**
 * Raises finite decimal values only when the exact result survives as Number.
 */
export function powerFiniteDecimalNumber(base: number, exponent: number) {
  if (
    !(Number.isFinite(base) && Number.isSafeInteger(exponent)) ||
    exponent < 0
  ) {
    return;
  }

  let value = 1;
  for (let index = 0; index < exponent; index += 1) {
    const nextValue = multiplyFiniteDecimalNumbers(value, base);
    if (nextValue === undefined) {
      return;
    }
    value = nextValue;
  }

  return value;
}

/**
 * Divides finite decimal string forms as exact terminating decimal quotients.
 */
function readFiniteDecimalQuotient(left: number, right: number) {
  const leftDecimal = readFiniteNumberDecimal(left);
  const rightDecimal = readFiniteNumberDecimal(right);
  const exponent = Math.min(leftDecimal.exponent, rightDecimal.exponent);
  const numerator =
    leftDecimal.coefficient * 10n ** BigInt(leftDecimal.exponent - exponent);
  const denominator =
    rightDecimal.coefficient * 10n ** BigInt(rightDecimal.exponent - exponent);

  const sign = denominator < 0n ? -1n : 1n;
  return readTerminatingDecimalQuotient(numerator * sign, denominator * sign);
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
 * Converts an exact rational quotient only when it terminates in base ten.
 */
function readTerminatingDecimalQuotient(
  numerator: bigint,
  denominator: bigint
) {
  let reducedNumerator = numerator;
  let reducedDenominator = denominator;
  const divisor = greatestCommonDivisor(reducedNumerator, reducedDenominator);
  reducedNumerator /= divisor;
  reducedDenominator /= divisor;

  let twos = 0;
  while (reducedDenominator % 2n === 0n) {
    reducedDenominator /= 2n;
    twos += 1;
  }

  let fives = 0;
  while (reducedDenominator % 5n === 0n) {
    reducedDenominator /= 5n;
    fives += 1;
  }

  if (reducedDenominator !== 1n) {
    return;
  }

  const scale = Math.max(twos, fives);
  const coefficient =
    reducedNumerator * 2n ** BigInt(scale - twos) * 5n ** BigInt(scale - fives);

  return readFiniteExactDecimalValue(coefficient, -scale);
}

/**
 * Computes the positive greatest common divisor for exact rational reduction.
 */
function greatestCommonDivisor(left: bigint, right: bigint) {
  let a = left < 0n ? -left : left;
  let b = right;

  while (b !== 0n) {
    const next = a % b;
    a = b;
    b = next;
  }

  return a;
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
