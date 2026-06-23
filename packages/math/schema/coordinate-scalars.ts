import type { ExactPoint3, ExactScalar } from "@repo/math/schema/ast";

const DECIMAL_HINT_TOLERANCE = 1e-4;
const NUMERIC_LITERAL_PATTERN =
  /^[+-]?(?:(?:\d+\.?\d*)|(?:\.\d+))(?:e[+-]?\d+)?$/i;
const UNSAFE_WHITESPACE_PATTERN = /[\dA-Za-zπ]\s+[\dA-Za-zπ]/;

/** Reads a finite numeric sort key from an exact scalar display contract. */
export function readSortableExactScalar(scalar: ExactScalar) {
  if (isBlankExactExpression(scalar.expression)) {
    return;
  }

  const exactValue = readFiniteExactExpression(scalar.expression);

  if (exactValue !== undefined) {
    if (hasInconsistentDecimalHint(scalar, exactValue)) {
      return;
    }

    return exactValue;
  }
}

/** Checks whether every coordinate has a parseable exact zero expression. */
export function isExactZeroPoint(point: ExactPoint3) {
  return (
    isExactZeroScalar(point.x) &&
    isExactZeroScalar(point.y) &&
    isExactZeroScalar(point.z)
  );
}

/** Reads the first point coordinate that lacks a finite sortable scalar value. */
export function readNonSortablePointAxis(point: ExactPoint3) {
  if (readSortableExactScalar(point.x) === undefined) {
    return "x";
  }

  if (readSortableExactScalar(point.y) === undefined) {
    return "y";
  }

  if (readSortableExactScalar(point.z) === undefined) {
    return "z";
  }
}

function isExactZeroScalar(scalar: ExactScalar) {
  if (isBlankExactExpression(scalar.expression)) {
    return false;
  }

  const exactValue = readFiniteExactExpression(scalar.expression);

  if (exactValue !== undefined) {
    return exactValue === 0;
  }
  return false;
}

function isBlankExactExpression(expression: string) {
  return expression.trim().length === 0;
}

function readFiniteDecimalHint(scalar: ExactScalar) {
  return scalar.decimal;
}

function readFiniteExactExpression(expression: string) {
  const compact = compactExactExpression(expression);
  if (!compact) {
    return;
  }

  return readExactNumericExpression(compact);
}

function compactExactExpression(expression: string) {
  const trimmed = expression.trim();
  if (trimmed.length === 0 || UNSAFE_WHITESPACE_PATTERN.test(trimmed)) {
    return;
  }

  return trimmed.replaceAll(/\s+/g, "");
}

function readExactNumericExpression(expression: string): number | undefined {
  const stripped = stripBalancedOuterParens(expression);
  const quotientParts = splitTopLevel(stripped, "/");
  if (quotientParts.length > 2) {
    return;
  }

  const numeratorExpression = quotientParts[0];
  if (numeratorExpression === undefined) {
    return;
  }

  const numerator = readExactNumericProduct(numeratorExpression);
  if (numerator === undefined) {
    return;
  }

  const denominatorExpression = quotientParts[1];
  if (denominatorExpression === undefined) {
    return numerator;
  }

  const denominator = readExactNumericProduct(denominatorExpression);
  if (denominator === undefined || denominator === 0) {
    return;
  }

  const value = numerator / denominator;
  return Number.isFinite(value) ? value : undefined;
}

function readExactNumericProduct(expression: string) {
  const productParts = splitTopLevel(stripBalancedOuterParens(expression), "*");
  let product = 1;
  for (const part of productParts) {
    const factor = readExactNumericAtom(part);
    if (factor === undefined) {
      return;
    }
    product *= factor;
  }

  return Number.isFinite(product) ? product : undefined;
}

function readExactNumericAtom(expression: string): number | undefined {
  const stripped = stripBalancedOuterParens(expression);
  if (stripped.length === 0) {
    return;
  }

  if (stripped.startsWith("+")) {
    return readExactNumericAtom(stripped.slice(1));
  }

  if (stripped.startsWith("-")) {
    const value = readExactNumericAtom(stripped.slice(1));
    return value === undefined ? undefined : -value;
  }

  if (NUMERIC_LITERAL_PATTERN.test(stripped)) {
    const parsed = Number(stripped);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (stripped === "π" || stripped.toLowerCase() === "pi") {
    return Math.PI;
  }
}

function stripBalancedOuterParens(expression: string) {
  let stripped = expression;

  while (isWrappedByBalancedParens(stripped)) {
    stripped = stripped.slice(1, -1);
  }

  return stripped;
}

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

function splitTopLevel(expression: string, delimiter: "/" | "*") {
  const parts: string[] = [];
  let depth = 0;
  let startIndex = 0;

  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index];

    if (character === "(") {
      depth += 1;
      continue;
    }

    if (character === ")") {
      depth -= 1;
      if (depth < 0) {
        return [];
      }
      continue;
    }

    if (character === delimiter && depth === 0) {
      parts.push(expression.slice(startIndex, index));
      startIndex = index + 1;
    }
  }

  if (depth !== 0) {
    return [];
  }

  parts.push(expression.slice(startIndex));
  return parts;
}

function hasInconsistentDecimalHint(scalar: ExactScalar, exactValue: number) {
  const decimal = readFiniteDecimalHint(scalar);
  if (decimal === undefined) {
    return false;
  }

  const allowedDrift =
    Math.max(1, Math.abs(exactValue)) * DECIMAL_HINT_TOLERANCE;
  return Math.abs(decimal - exactValue) > allowedDrift;
}
