import type { ExactPoint3, ExactScalar } from "@repo/math/schema/ast";

const DECIMAL_HINT_TOLERANCE = 1e-4;
const NUMERIC_LITERAL_PATTERN =
  /^[+-]?(?:(?:\d+\.?\d*)|(?:\.\d+))(?:e[+-]?\d+)?$/i;
const UNSAFE_WHITESPACE_PATTERN = /[\dA-Za-zπ]\s+[\dA-Za-zπ]/;

interface ExactNumericFactor {
  expression: string;
  operator: "*" | "/";
}

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
  const sequence = splitTopLevelFactors(stripped);
  if (sequence.first === undefined) {
    return;
  }

  let value = readExactNumericAtom(sequence.first);
  if (value === undefined) {
    return;
  }

  for (const factor of sequence.rest) {
    const factorValue = readExactNumericAtom(factor.expression);
    if (factorValue === undefined) {
      return;
    }

    if (factor.operator === "*") {
      value *= factorValue;
      continue;
    }

    if (factorValue === 0) {
      return;
    }
    value /= factorValue;
  }

  return Number.isFinite(value) ? value : undefined;
}

function readExactNumericAtom(expression: string): number | undefined {
  const stripped = stripBalancedOuterParens(expression);
  if (stripped.length === 0) {
    return;
  }

  if (stripped !== expression) {
    return readExactNumericExpression(stripped);
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

function splitTopLevelFactors(expression: string) {
  const rest: ExactNumericFactor[] = [];
  let first: string | undefined;
  let depth = 0;
  let pendingOperator: "*" | "/" | undefined;
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
        return { first: undefined, rest: [] };
      }
      continue;
    }

    if ((character === "*" || character === "/") && depth === 0) {
      const part = expression.slice(startIndex, index);
      if (pendingOperator) {
        rest.push({ expression: part, operator: pendingOperator });
      } else {
        first = part;
      }
      pendingOperator = character;
      startIndex = index + 1;
    }
  }

  if (depth !== 0) {
    return { first: undefined, rest: [] };
  }

  const part = expression.slice(startIndex);
  if (pendingOperator) {
    rest.push({ expression: part, operator: pendingOperator });
  } else {
    first = part;
  }

  return { first, rest };
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
