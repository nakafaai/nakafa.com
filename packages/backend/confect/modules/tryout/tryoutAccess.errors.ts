import { Schema } from "effect";

/** Typed access campaign failure used by tryout access services. */
export class TryoutAccessError extends Schema.TaggedError<TryoutAccessError>()(
  "TryoutAccessError",
  {
    code: Schema.String,
    message: Schema.String,
  }
) {}
