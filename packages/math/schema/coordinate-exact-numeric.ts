const NUMERIC_LITERAL_PATTERN =
  /^[+-]?(?:(?:\d+\.?\d*)|(?:\.\d+))(?:e[+-]?\d+)?$/i;
const UNSAFE_WHITESPACE_PATTERN = /[\dA-Za-zπ]\s+[\dA-Za-zπ]/;
const UNSAFE_DECIMAL_WHITESPACE_PATTERN =
  /(?:\d\s+\.)|(?:\.\s+\d)|(?:\d\.\s+\d)/;
const UNSAFE_EXPONENT_WHITESPACE_PATTERN =
  /(?:\d|\.)[eE]\s*[+-]?\s+\d|(?:\d|\.)[eE]\s+[+-]?\s*\d/;
const DIGIT_PATTERN = /\d/;
const EXPONENT_SEPARATOR_PATTERN = /[eE]/;
const PLAIN_INTEGER_LITERAL_PATTERN = /^[+-]?\d+(?:\.0*)?$/;
const SIGN_PREFIX_PATTERN = /^[+-]/;
const ZERO_MANTISSA_PATTERN = /^[0.]+$/;

interface ExactNumericFactor {
  expression: string;
  operator: "*" | "/";
}

interface ExactNumericValue {
  isExactZero: boolean;
  isUnderflow: boolean;
  value: number;
}

/** Parses a narrow exact numeric grammar into a finite sortable number. */
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

function compactExactExpression(expression: string) {
  const trimmed = expression.trim();
  if (
    trimmed.length === 0 ||
    UNSAFE_WHITESPACE_PATTERN.test(trimmed) ||
    UNSAFE_DECIMAL_WHITESPACE_PATTERN.test(trimmed) ||
    UNSAFE_EXPONENT_WHITESPACE_PATTERN.test(trimmed)
  ) {
    return;
  }

  return trimmed.replaceAll(/\s+/g, "");
}

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
    return finiteNumericValue(Math.PI);
  }
}

function readNumericLiteralValue(literal: string) {
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

  if (parsed === 0) {
    return isSyntacticZeroLiteral(literal)
      ? exactZeroValue()
      : underflowValue();
  }

  return finiteNumericValue(parsed);
}

function multiplyNumericValue(
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

function divideNumericValue(left: ExactNumericValue, right: ExactNumericValue) {
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

function finiteComputedValue(value: number) {
  if (!Number.isFinite(value)) {
    return;
  }

  return value === 0 ? underflowValue() : finiteNumericValue(value);
}

function finiteNumericValue(value: number): ExactNumericValue {
  return { isExactZero: false, isUnderflow: false, value };
}

function exactZeroValue(): ExactNumericValue {
  return { isExactZero: true, isUnderflow: false, value: 0 };
}

function underflowValue(): ExactNumericValue {
  return { isExactZero: false, isUnderflow: true, value: 0 };
}

function isSyntacticZeroLiteral(literal: string) {
  const unsigned = literal.replace(SIGN_PREFIX_PATTERN, "");
  const exponentIndex = unsigned.search(EXPONENT_SEPARATOR_PATTERN);
  const mantissa =
    exponentIndex === -1 ? unsigned : unsigned.slice(0, exponentIndex);

  return DIGIT_PATTERN.test(mantissa) && ZERO_MANTISSA_PATTERN.test(mantissa);
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
