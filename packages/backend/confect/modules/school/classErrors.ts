import { Schema } from "effect";

export class ClassActionError extends Schema.TaggedError<ClassActionError>()(
  "ClassActionError",
  { message: Schema.String }
) {}
