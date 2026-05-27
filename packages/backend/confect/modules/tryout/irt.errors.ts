import { Schema } from "effect";

/** Typed IRT failure transported through Confect Effect implementations. */
export class IrtError extends Schema.TaggedError<IrtError>()("IrtError", {
  code: Schema.String,
  message: Schema.String,
}) {}
