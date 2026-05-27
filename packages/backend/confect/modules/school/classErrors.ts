import { Schema } from "effect";

export class ClassActionError extends Schema.TaggedError<ClassActionError>()(
  "ClassActionError",
  {
    code: Schema.optional(Schema.String),
    message: Schema.String,
  }
) {}
