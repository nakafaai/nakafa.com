import { Schema } from "effect";

/** Typed tryout lifecycle failure used by Effect services. */
export class TryoutError extends Schema.TaggedError<TryoutError>()(
  "TryoutError",
  {
    code: Schema.String,
    message: Schema.String,
  }
) {}
