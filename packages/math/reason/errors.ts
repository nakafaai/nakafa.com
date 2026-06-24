import { Schema } from "effect";

/** Raised when MathReasoning receives an invalid caller request. */
export class MathReasoningInputError extends Schema.TaggedError<MathReasoningInputError>()(
  "MathReasoningInputError",
  {
    message: Schema.String,
  }
) {}

/** Raised when a learner prompt cannot be planned into a CAS computation. */
export class MathPlanningError extends Schema.TaggedError<MathPlanningError>()(
  "MathPlanningError",
  {
    message: Schema.String,
  }
) {}

/** Raised when a deterministic CAS Adapter cannot provide usable evidence. */
export class MathCasAdapterError extends Schema.TaggedError<MathCasAdapterError>()(
  "MathCasAdapterError",
  {
    message: Schema.String,
  }
) {}

/** Raised when durable MathWork persistence fails. */
export class MathPersistenceError extends Schema.TaggedError<MathPersistenceError>()(
  "MathPersistenceError",
  {
    message: Schema.String,
    source: Schema.String,
  }
) {}
