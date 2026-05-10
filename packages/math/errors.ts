import { Schema } from "effect";

/** Raised when the configured CAS endpoint cannot be reached or rejects a call. */
export class MathCasRequestError extends Schema.TaggedError<MathCasRequestError>(
  "MathCasRequestError"
)("MathCasRequestError", {
  message: Schema.String,
  status: Schema.optional(Schema.Number),
}) {}

/** Raised when the CAS response does not match the shared math contract. */
export class MathCasResponseError extends Schema.TaggedError<MathCasResponseError>(
  "MathCasResponseError"
)("MathCasResponseError", {
  message: Schema.String,
}) {}
