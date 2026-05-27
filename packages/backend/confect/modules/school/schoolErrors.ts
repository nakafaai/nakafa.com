import { Schema } from "effect";

/** Expected school-domain failure transported by Confect when declared in specs. */
export class SchoolActionError extends Schema.TaggedError<SchoolActionError>()(
  "SchoolActionError",
  {
    code: Schema.optional(Schema.String),
    message: Schema.String,
  }
) {}
