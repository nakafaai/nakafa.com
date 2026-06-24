import { MathPlanningError } from "@repo/math/reason/errors";
import type { MathOperation } from "@repo/math/schema/operations";
import { type MathRequest, MathRequestSchema } from "@repo/math/schema/request";
import { getExpressionSymbols } from "@repo/math/schema/shared";
import type { MathReasoningRequestShape } from "@repo/math/schema/work";
import { Effect, Schema } from "effect";

const EQUATION_OPERATOR_PATTERN = /[=<>]/u;
const CIRCLE_KEYWORD_PATTERN = /\bcircle\b|lingkaran/iu;
const LINE_KEYWORD_PATTERN = /\bline\b|garis/iu;
const FACTOR_KEYWORD_PATTERN = /\bfactor\b|faktor/iu;
const DERIVATIVE_KEYWORD_PATTERN =
  /\b(?:derivative|differentiate)\b|turunan|turunkan/iu;
const INTEGRAL_KEYWORD_PATTERN = /\b(?:integral|integrate)\b|integralkan/iu;
const SIMPLIFY_KEYWORD_PATTERN = /\bsimplify\b|sederhana/iu;
const SOLVE_KEYWORD_PATTERN =
  /\b(?:solve|akar|selesaikan|tentukan|cari|mencari)\b/iu;
const DERIVATIVE_EXPRESSION_PATTERN =
  /(?:derivative|differentiate|turunan|turunkan)\s+(?:of\s+)?(?<expression>.+)$/iu;
const INTEGRAL_EXPRESSION_PATTERN =
  /(?:integral|integrate|integralkan)\s+(?:of\s+)?(?<expression>.+)$/iu;
const BASIC_EXPRESSION_PATTERN =
  /(?:solve|simplify|factor|faktor|faktorkan|sederhanakan|selesaikan|tentukan|cari)\s+(?<expression>.+)$/iu;
const STANDALONE_MATH_PATTERN =
  /[0-9A-Za-z][0-9A-Za-z\s+\-*/^().=<>]*[0-9A-Za-z)]/u;
const MATH_SIGNAL_PATTERN = /[0-9=<>+\-*/^()]/u;
const TRAILING_INSTRUCTION_PATTERN =
  /\s+(?:and|dan|then|lalu|serta|with|dengan|please|tolong|show|tunjukkan|explain|jelaskan)\b.*$/iu;
const TRAILING_SENTENCE_PUNCTUATION_PATTERN = /[?.!,;:]+$/u;
const COORDINATE_PAIR_PATTERN = /\(\s*([^,()]+)\s*,\s*([^,()]+)\s*\)/gu;
const MATH_TERM_PATTERN_SOURCE = String.raw`(?:[A-Za-z](?:\^\d+(?:\.\d+)?)?|\d+(?:\.\d+)?[A-Za-z]?(?:\^\d+(?:\.\d+)?)?|\([^()]+\))`;
const MATH_SEQUENCE_TAIL_PATTERN = new RegExp(
  String.raw`(${MATH_TERM_PATTERN_SOURCE}(?:\s*[+\-*/^]\s*${MATH_TERM_PATTERN_SOURCE})*)\s*$`,
  "u"
);
const MATH_SEQUENCE_HEAD_PATTERN = new RegExp(
  String.raw`^\s*(${MATH_TERM_PATTERN_SOURCE}(?:\s*[+\-*/^]\s*${MATH_TERM_PATTERN_SOURCE})*)`,
  "u"
);

/** Plans the first MathReasoning slice into one deterministic CAS request. */
export const planCasRequest = Effect.fn("MathReasoning.planCasRequest")(
  function* (input: MathReasoningRequestShape) {
    const text = normalizeText(input);
    const operation = detectOperation(text);

    if (operation === "line" || operation === "circle") {
      const points = extractPoints(text);

      if (points.length < 2) {
        return yield* Effect.fail(
          new MathPlanningError({
            message:
              "Coordinate geometry requests need at least two explicit points.",
          })
        );
      }

      return yield* Schema.decodeUnknown(MathRequestSchema)({
        kind: "math",
        operation,
        points,
      }).pipe(
        Effect.mapError(
          (error) =>
            new MathPlanningError({
              message: error.message,
            })
        )
      );
    }

    return buildCandidate({ operation, text });
  }
);

/** Collapses the learner request fields into one CAS-planning text body. */
function normalizeText(input: MathReasoningRequestShape) {
  return [input.request, input.objective, ...input.givens]
    .join("\n")
    .replaceAll("−", "-")
    .trim();
}

/** Infers the first-slice math operation from explicit keywords or equation syntax. */
function detectOperation(text: string): MathOperation {
  if (CIRCLE_KEYWORD_PATTERN.test(text)) {
    return "circle";
  }

  if (LINE_KEYWORD_PATTERN.test(text)) {
    return "line";
  }

  if (FACTOR_KEYWORD_PATTERN.test(text)) {
    return "factor";
  }

  if (DERIVATIVE_KEYWORD_PATTERN.test(text)) {
    return "differentiate";
  }

  if (INTEGRAL_KEYWORD_PATTERN.test(text)) {
    return "integrate";
  }

  if (SIMPLIFY_KEYWORD_PATTERN.test(text)) {
    return "simplify";
  }

  if (SOLVE_KEYWORD_PATTERN.test(text)) {
    return "solve";
  }

  if (EQUATION_OPERATOR_PATTERN.test(text)) {
    return "solve";
  }

  return "simplify";
}

/** Builds the candidate request object before schema validation brands it. */
function buildCandidate({
  operation,
  text,
}: {
  readonly operation: MathOperation;
  readonly text: string;
}): MathRequest {
  const expression = extractExpression(text, operation);
  const variable = inferVariable(expression);

  if (operation === "solve") {
    return {
      expression,
      kind: "math",
      operation,
      variables: variable ? [variable] : [],
    };
  }

  if (operation === "differentiate" || operation === "integrate") {
    return {
      expression,
      kind: "math",
      operation,
      ...(variable ? { variable } : {}),
    };
  }

  return {
    expression,
    kind: "math",
    operation,
  };
}

/** Extracts the most likely mathematical expression from the prompt text. */
function extractExpression(text: string, operation: MathOperation) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const keywordPattern = keywordExpressionPattern(operation);

  for (const line of lines) {
    const match = keywordPattern.exec(line);
    const captured = match?.groups?.expression?.trim();
    if (captured) {
      return cleanExpression(captured);
    }
  }

  for (const line of lines) {
    if (looksLikeMath(line)) {
      return cleanExpression(line);
    }
  }

  return text;
}

/** Selects the operation-specific keyword pattern used to capture expressions. */
function keywordExpressionPattern(operation: MathOperation) {
  if (operation === "differentiate") {
    return DERIVATIVE_EXPRESSION_PATTERN;
  }

  if (operation === "integrate") {
    return INTEGRAL_EXPRESSION_PATTERN;
  }

  return BASIC_EXPRESSION_PATTERN;
}

/** Checks whether a text line resembles a standalone mathematical expression. */
function looksLikeMath(line: string) {
  return MATH_SIGNAL_PATTERN.test(line) && STANDALONE_MATH_PATTERN.test(line);
}

/** Removes punctuation that belongs to the sentence rather than the expression. */
function stripTrailingInstruction(expression: string) {
  return expression
    .replace(TRAILING_INSTRUCTION_PATTERN, "")
    .replace(TRAILING_SENTENCE_PUNCTUATION_PATTERN, "")
    .trim();
}

/** Removes learner wording around the expression after a keyword match. */
function cleanExpression(expression: string) {
  const stripped = stripTrailingInstruction(expression);
  return extractEquationFragment(stripped) ?? stripped;
}

/** Extracts the equation-shaped suffix from descriptive sentence prompts. */
function extractEquationFragment(expression: string) {
  const match = EQUATION_OPERATOR_PATTERN.exec(expression);
  if (!match) {
    return;
  }

  const operator = match[0];
  const left = expression.slice(0, match.index);
  const right = expression.slice(match.index + operator.length);
  const leftExpression = MATH_SEQUENCE_TAIL_PATTERN.exec(left)?.[1]?.trim();
  const rightExpression = MATH_SEQUENCE_HEAD_PATTERN.exec(right)?.[1]?.trim();

  if (!(leftExpression && rightExpression)) {
    return;
  }

  return `${leftExpression} ${operator} ${rightExpression}`;
}

/** Infers the symbolic variable for unary algebra and calculus operations. */
function inferVariable(expression: string) {
  const symbols = [...getExpressionSymbols(expression)];
  if (symbols.length === 1) {
    return symbols[0];
  }

  if (symbols.includes("x")) {
    return "x";
  }

  return;
}

/** Parses coordinate pairs used by the first visual-intent geometry slice. */
function extractPoints(text: string) {
  const points: NonNullable<MathRequest["points"]> = [];
  const matches = text.matchAll(COORDINATE_PAIR_PATTERN);

  for (const match of matches) {
    const x = match[1]?.trim();
    const y = match[2]?.trim();
    if (x && y) {
      points.push({ x, y });
    }
  }

  return points;
}
