import { Schema } from "effect";

/** Typed assessment failure used by Effect assessment services. */
export class AssessmentError extends Schema.TaggedError<AssessmentError>()(
  "AssessmentError",
  {
    code: Schema.String,
    message: Schema.String,
  }
) {}
