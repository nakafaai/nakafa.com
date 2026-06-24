import { MathPlanningError } from "@repo/math/reason/errors";
import { buildSolveRequest } from "@repo/math/reason/solve";
import { detectUnsupportedMathReasoningOperation } from "@repo/math/reason/support";
import type { MathReasoningOperation } from "@repo/math/schema/operations";
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
const CALCULUS_VARIABLE_PATTERN =
  /\b(?:with respect to|wrt|terhadap)\s+(?<variable>[A-Za-z_][A-Za-z0-9_]*)\b/iu;
const BASIC_EXPRESSION_PATTERN =
  /(?:solve|simplify|factor|faktor|faktorkan|sederhanakan|selesaikan|tentukan|cari)\s+(?<expression>.+)$/iu;
const STANDALONE_MATH_PATTERN =
  /[0-9A-Za-z][0-9A-Za-z\s+\-*/^().=<>]*[0-9A-Za-z)]/u;
const MATH_SIGNAL_PATTERN = /[0-9=<>+\-*/^()]/u;
const TRAILING_CONNECTOR_PATTERN =
  /\s+(?:and|dan|then|lalu|serta|with|dengan|please|tolong|show|tunjukkan|explain|jelaskan)\b/giu;
const TRAILING_SENTENCE_PUNCTUATION_PATTERN = /[?.!,;:]+$/u;
const COORDINATE_PAIR_PATTERN = /\(\s*([^,()]+)\s*,\s*([^,()]+)\s*\)/gu;

/** Plans the first MathReasoning slice into one deterministic CAS request. */
export const planCasRequest = Effect.fn("MathReasoning.planCasRequest")(
  function* (input: MathReasoningRequestShape) {
    const text = normalizeText(input);
    const unsupportedOperation = detectUnsupportedMathReasoningOperation(text);
    if (unsupportedOperation) {
      return yield* Effect.fail(
        new MathPlanningError({
          message: `MathReasoning does not yet plan ${unsupportedOperation} requests.`,
        })
      );
    }

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

    return yield* buildCandidate({ operation, text });
  }
);

/** Collapses the learner request fields into one CAS-planning text body. */
function normalizeText(input: MathReasoningRequestShape) {
  return [
    input.request,
    input.objective,
    ...input.givens,
    ...input.requirements,
  ]
    .join("\n")
    .replaceAll("−", "-")
    .trim();
}

/** Infers the first-slice math operation from explicit keywords or equation syntax. */
function detectOperation(text: string): MathReasoningOperation {
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
const buildCandidate = Effect.fn("MathReasoning.buildCandidate")(function* ({
  operation,
  text,
}: {
  readonly operation: MathReasoningOperation;
  readonly text: string;
}) {
  const expression = extractExpression(text, operation);

  if (operation === "solve") {
    return yield* buildSolveRequest({ expression, text });
  }

  if (operation === "differentiate" || operation === "integrate") {
    const variable = yield* inferCalculusVariable({
      expression,
      requestedVariable: extractExplicitVariable(text),
    });

    return {
      expression,
      kind: "math" as const,
      operation,
      variable,
    };
  }

  return {
    expression,
    kind: "math" as const,
    operation,
  };
});

/** Extracts the most likely mathematical expression from the prompt text. */
function extractExpression(text: string, operation: MathReasoningOperation) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const keywordPattern = keywordExpressionPattern(operation);

  for (const line of lines) {
    const match = keywordPattern.exec(line);
    const captured = match?.groups?.expression?.trim();
    if (captured) {
      return stripTrailingInstruction(captured);
    }
  }

  for (const line of lines) {
    if (looksLikeMath(line)) {
      return stripTrailingInstruction(line);
    }
  }

  return text;
}

/** Selects the operation-specific keyword pattern used to capture expressions. */
function keywordExpressionPattern(operation: MathReasoningOperation) {
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
  const withoutVariablePhrase = expression.replace(
    CALCULUS_VARIABLE_PATTERN,
    ""
  );
  const stripped = stripTrailingProseClause(withoutVariablePhrase);
  return stripped.replace(TRAILING_SENTENCE_PUNCTUATION_PATTERN, "").trim();
}

/** Removes trailing prose while preserving math clauses after connectors. */
function stripTrailingProseClause(expression: string) {
  const matches = expression.matchAll(TRAILING_CONNECTOR_PATTERN);
  for (const match of matches) {
    const tail = expression.slice(match.index + match[0].length);
    if (EQUATION_OPERATOR_PATTERN.test(tail)) {
      continue;
    }

    return expression.slice(0, match.index).trim();
  }

  return expression.trim();
}

/** Extracts an explicit calculus variable from learner wording. */
function extractExplicitVariable(text: string) {
  return CALCULUS_VARIABLE_PATTERN.exec(text)?.groups?.variable;
}

/** Infers or validates the variable used by unary calculus operations. */
function inferCalculusVariable({
  expression,
  requestedVariable,
}: {
  readonly expression: string;
  readonly requestedVariable: string | undefined;
}) {
  const symbols = [...getExpressionSymbols(expression)];
  if (requestedVariable) {
    if (symbols.includes(requestedVariable)) {
      return Effect.succeed(requestedVariable);
    }

    return Effect.fail(
      new MathPlanningError({
        message:
          "Requested calculus variable is not present in the expression.",
      })
    );
  }

  if (symbols.length === 1) {
    return Effect.succeed(symbols[0]);
  }

  if (symbols.length > 1) {
    return Effect.fail(
      new MathPlanningError({
        message:
          "Calculus requests with multiple variables need an explicit variable.",
      })
    );
  }

  return Effect.succeed("x");
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
