import {
  divideFiniteDecimalNumbers,
  isRoundedPiSentinel,
  multiplyFiniteDecimalNumbers,
  readFiniteDecimalSum,
} from "@repo/math/schema/ast/decimal";
import { readExactNumericExpression } from "@repo/math/schema/coordinate/numeric";

const PI_TOKEN_PATTERN = /π|pi/gi;
const PI_TOKEN_DETECTION_PATTERN = /π|pi/i;

/**
 * Reads a syntactic finite multiple of pi from the exact scalar grammar.
 */
export function readSyntacticPiMultiple(expression: string, value: number) {
  const compact = expression.trim().replaceAll(/\s+/g, "");
  const matches = compact.match(PI_TOKEN_PATTERN);
  if (matches?.length === 1) {
    if (!isNumeratorSidePiToken(compact)) {
      return;
    }

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
  return (
    multiple !== undefined &&
    !Number.isInteger(multiple) &&
    Number.isInteger(multiple - 0.5)
  );
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
    return readSafePiProduct(left.piMultiple, right.value);
  }

  if (right.piMultiple !== undefined && left.piMultiple === undefined) {
    return readSafePiProduct(right.piMultiple, left.value);
  }
}

/**
 * Carries a syntactic pi numerator through division by a numeric scalar.
 */
export function readQuotientPiMultiple(
  left: { readonly piMultiple?: number; readonly value: number },
  right: { readonly piMultiple?: number; readonly value: number }
) {
  if (left.piMultiple === undefined || right.piMultiple !== undefined) {
    return;
  }

  return divideFiniteDecimalNumbers(left.piMultiple, right.value);
}

/** Combines finite pi multiples without losing nonzero fractional offsets.
 */
function combineFinitePiMultiples(
  left: number,
  right: number,
  operator: "add" | "subtract"
) {
  return readFiniteDecimalSum(left, right, operator);
}

/**
 * Rejects pi products that would drift into a trig sentinel.
 */
function readSafePiProduct(piMultiple: number, scalar: number) {
  const product = multiplyFiniteDecimalNumbers(piMultiple, scalar);
  if (isRoundedPiSentinel(product)) {
    return;
  }

  return product;
}

/**
 * Confirms the single pi token contributes from the numerator side.
 */
function isNumeratorSidePiToken(expression: string) {
  return readPiTokenOrientation(expression, 1) === 1;
}

/**
 * Reads whether the single pi token is in a numerator or denominator position.
 */
function readPiTokenOrientation(
  expression: string,
  orientation: 1 | -1
): 1 | -1 | undefined {
  const stripped = stripPiExpressionWrappers(expression);
  let depth = 0;
  let found: 1 | -1 | undefined;
  let pendingOperator: string | undefined;
  let startIndex = 0;
  let hasTopLevelOperator = false;

  for (let index = 0; index < stripped.length; index += 1) {
    const character = stripped[index];

    if (character === "(") {
      depth += 1;
      continue;
    }

    if (character === ")") {
      depth -= 1;
      continue;
    }

    if ((character === "*" || character === "/") && depth === 0) {
      hasTopLevelOperator = true;
      found = readPiFactorOrientation(
        stripped.slice(startIndex, index),
        pendingOperator,
        orientation,
        found
      );
      pendingOperator = character;
      startIndex = index + 1;
    }
  }

  if (!hasTopLevelOperator) {
    return PI_TOKEN_DETECTION_PATTERN.test(stripped) ? orientation : undefined;
  }

  return readPiFactorOrientation(
    stripped.slice(startIndex),
    pendingOperator,
    orientation,
    found
  );
}

/**
 * Reads a factor's pi orientation while accounting for division polarity.
 */
function readPiFactorOrientation(
  expression: string,
  operator: string | undefined,
  orientation: 1 | -1,
  existing: 1 | -1 | undefined
): 1 | -1 | undefined {
  let factorOrientation = orientation;
  if (operator === "/") {
    factorOrientation = orientation === 1 ? -1 : 1;
  }

  const found = readPiTokenOrientation(expression, factorOrientation);
  return found === undefined ? existing : found;
}

/**
 * Removes grouping and sign wrappers that do not change pi orientation.
 */
function stripPiExpressionWrappers(expression: string) {
  let stripped = stripBalancedOuterParens(expression);
  while (stripped.startsWith("+") || stripped.startsWith("-")) {
    stripped = stripBalancedOuterParens(stripped.slice(1));
  }

  return stripped;
}

/**
 * Removes balanced wrapper parentheses without changing factor polarity.
 */
function stripBalancedOuterParens(expression: string) {
  let stripped = expression;

  while (isWrappedByBalancedParens(stripped)) {
    stripped = stripped.slice(1, -1);
  }

  return stripped;
}

/**
 * Checks that outer parentheses enclose the whole pi expression.
 */
function isWrappedByBalancedParens(expression: string) {
  if (!(expression.startsWith("(") && expression.endsWith(")"))) {
    return false;
  }

  let depth = 0;
  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index];

    if (character === "(") {
      depth += 1;
    }

    if (character === ")") {
      depth -= 1;
      if (depth === 0 && index < expression.length - 1) {
        return false;
      }
    }
  }

  return depth === 0;
}
