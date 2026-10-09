import { publicFailure } from "@repo/backend/confect/failure";
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
export const TryoutSelectorReadErrorWire = publicFailure(
  TryoutSelectorReadError
);
export function selectorIntegrity(message: string) {
  return TryoutSelectorReadError.make({
    code: "TRYOUT_SELECTOR_INTEGRITY",
    message,
  });
}
