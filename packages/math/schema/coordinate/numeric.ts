import {
  divideNumericValue,
  type ExactNumericValue,
  finiteNumericValue,
  multiplyNumericValue,
  readNumericLiteralValue,
} from "@repo/math/schema/coordinate/decimal";
import { Schema } from "effect";

const NUMERIC_LITERAL_PATTERN =
  /^[+-]?(?:(?:\d+\.?\d*)|(?:\.\d+))(?:e[+-]?\d+)?$/i;
const UNSAFE_WHITESPACE_PATTERN = /[\dA-Za-zπ]\s+[\dA-Za-zπ]/;
const UNSAFE_DECIMAL_WHITESPACE_PATTERN =
  /(?:\d\s+\.)|(?:\.\s+\d)|(?:\d\.\s+\d)/;
const UNSAFE_EXPONENT_WHITESPACE_PATTERN =
  /(?:\d|\.)[eE]\s*[+-]?\s+\d|(?:\d|\.)[eE]\s+[+-]?\s*\d/;
const UNSAFE_SIGN_WHITESPACE_PATTERN = /(?:^|[*/(])\s*[+-]\s+(?=[\d.πpP(])/;
const ExactNumericFactor = Schema.Struct({
  expression: Schema.String,
  operator: Schema.Literal("*", "/"),
});

type ExactNumericFactor = Schema.Schema.Type<typeof ExactNumericFactor>;

/** Parses a narrow exact numeric grammar into a finite sortable number.
 */
export function readExactNumericExpression(expression: string) {
  const compact = compactExactExpression(expression);
  if (!compact) {
    return;
  }

  const numericValue = readExactNumericExpressionValue(compact);

  if (!numericValue || numericValue.isUnderflow) {
    return;
  }

  return numericValue.value;
}

/** Removes harmless operator whitespace while rejecting token mutation.
 */
function compactExactExpression(expression: string) {
  const trimmed = expression.trim();
  if (
    trimmed.length === 0 ||
    UNSAFE_WHITESPACE_PATTERN.test(trimmed) ||
    UNSAFE_DECIMAL_WHITESPACE_PATTERN.test(trimmed) ||
    UNSAFE_EXPONENT_WHITESPACE_PATTERN.test(trimmed) ||
    UNSAFE_SIGN_WHITESPACE_PATTERN.test(trimmed)
  ) {
    return;
  }

  return trimmed.replaceAll(/\s+/g, "");
}

/** Evaluates a compact exact expression as a left-to-right factor chain.
 */
function readExactNumericExpressionValue(
  expression: string
): ExactNumericValue | undefined {
  const stripped = stripBalancedOuterParens(expression);
  const sequence = splitTopLevelFactors(stripped);
  if (sequence.first === undefined) {
    return;
  }

  let value = readExactNumericAtomValue(sequence.first);
  if (!value) {
    return;
  }

  for (const factor of sequence.rest) {
    const factorValue = readExactNumericAtomValue(factor.expression);
    if (!factorValue) {
      return;
    }

    if (factor.operator === "*") {
      value = multiplyNumericValue(value, factorValue);
    } else {
      value = divideNumericValue(value, factorValue);
    }

    if (!value) {
      return;
    }
  }

  return value;
}

/** Reads one parenthesized atom, signed atom, literal, or pi token.
 */
function readExactNumericAtomValue(
  expression: string
): ExactNumericValue | undefined {
  const stripped = stripBalancedOuterParens(expression);
  if (stripped.length === 0) {
    return;
  }

  if (stripped !== expression) {
    return readExactNumericExpressionValue(stripped);
  }

  if (stripped.startsWith("+")) {
    return readExactNumericAtomValue(stripped.slice(1));
  }

  if (stripped.startsWith("-")) {
    const value = readExactNumericAtomValue(stripped.slice(1));
    return value ? { ...value, value: -value.value } : undefined;
  }

  if (NUMERIC_LITERAL_PATTERN.test(stripped)) {
    return readNumericLiteralValue(stripped);
  }

  if (stripped === "π" || stripped.toLowerCase() === "pi") {
    return finiteNumericValue(Math.PI, { usesApproximateValue: true });
  }
}

/** Removes balanced wrapper parentheses without changing inner grouping.
 */
function stripBalancedOuterParens(expression: string) {
  let stripped = expression;

  while (isWrappedByBalancedParens(stripped)) {
    stripped = stripped.slice(1, -1);
  }

  return stripped;
}

/** Checks that outer parentheses enclose the whole expression.
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

/** Splits top-level multiplication and division factors left to right.
 */
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
