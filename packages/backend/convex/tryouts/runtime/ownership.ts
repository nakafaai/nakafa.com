import { Schema } from "effect";

/** Stable failure while resolving signed attempt runtime ownership. */
export class TryoutSelectorReadError extends Schema.TaggedError<TryoutSelectorReadError>()(
  "TryoutSelectorReadError",
  {
    cause: Schema.optional(Schema.Unknown),
    code: Schema.Literal("TRYOUT_SELECTOR_INTEGRITY"),
    message: Schema.String,
  }
) {}

/** Creates one typed fail-closed selector integrity error. */
export function selectorIntegrity(message: string) {
  return new TryoutSelectorReadError({
    code: "TRYOUT_SELECTOR_INTEGRITY",
    message,
  });
}
