import { Schema } from "effect";

/** Raised when Math.js cannot parse a user expression. */
export class MathExpressionParseError extends Schema.TaggedError<MathExpressionParseError>(
  "MathExpressionParseError"
)("MathExpressionParseError", {
  cause: Schema.String,
  expression: Schema.String,
  message: Schema.String,
}) {}

/** Raised when a parsed expression cannot be evaluated deterministically. */
export class MathEvaluationError extends Schema.TaggedError<MathEvaluationError>(
  "MathEvaluationError"
)("MathEvaluationError", {
  cause: Schema.String,
  expression: Schema.String,
  message: Schema.String,
}) {}

/** Raised when the deterministic math engine does not support the operation. */
export class MathUnsupportedError extends Schema.TaggedError<MathUnsupportedError>(
  "MathUnsupportedError"
)("MathUnsupportedError", {
  expression: Schema.String,
  message: Schema.String,
}) {}
