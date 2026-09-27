import { failureWire } from "@repo/backend/confect/failure";
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
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
export const TryoutSelectorReadErrorWire = failureWire(TryoutSelectorReadError);
export function selectorIntegrity(message: string) {
  return new TryoutSelectorReadError({
    code: "TRYOUT_SELECTOR_INTEGRITY",
    message,
  });
}
