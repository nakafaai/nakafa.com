import { Schema } from "effect";

/** A class must exist, be active for writes, and belong to the viewer's school. */
export class ClassAccessError extends Schema.TaggedError<ClassAccessError>()(
  "ClassAccessError",
  {
    code: Schema.Literals([
      "CLASS_NOT_FOUND",
      "CLASS_ARCHIVED",
      "ACCESS_DENIED",
    ]),
    message: Schema.String,
  }
) {}
