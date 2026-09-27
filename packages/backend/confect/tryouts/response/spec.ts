import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import type { ConvexTaggedError } from "@repo/backend/confect/failure";
import { failureWire } from "@repo/backend/confect/failure";
import { tryoutResponseSelectionValidator } from "@repo/backend/confect/tryouts/response/model";
import { Schema } from "effect";
export const saveTryoutResponseArgsValidator = Schema.Struct({
  placementId: IdSchema("tryoutAttemptPlacements"),
  selection: Schema.Union([tryoutResponseSelectionValidator, Schema.Null]),
});
export type SaveTryoutResponseArgs = Schema.Schema.Type<
  typeof saveTryoutResponseArgsValidator
>;
export const saveTryoutResponseResultValidator = Schema.Null;

/** Expected failure while saving one selected try-out response. */
export class TryoutResponseError
  extends Schema.TaggedError<TryoutResponseError>()("TryoutResponseError", {
    cause: Schema.optional(Schema.Unknown),
    code: Schema.Literals([
      "TRYOUT_RESPONSE_FAILED",
      "TRYOUT_PLACEMENT_NOT_FOUND",
      "TRYOUT_EXPIRED",
    ]),
    message: Schema.String,
  })
  implements ConvexTaggedError {}

export const TryoutResponseErrorWire = failureWire(TryoutResponseError);
/** Redacts unexpected storage failures while retaining the internal cause. */
export function toTryoutResponseError(error: unknown) {
  return new TryoutResponseError({
    cause: error,
    code: "TRYOUT_RESPONSE_FAILED",
    message: "Unable to save try-out response.",
  });
}
/** A learner selection does not belong to its immutable response definition. */
export class TryoutResponseSelectionError extends Schema.TaggedError<TryoutResponseSelectionError>()(
  "TryoutResponseSelectionError",
  {
    code: Schema.Literals([
      "TRYOUT_RESPONSE_KIND_MISMATCH",
      "TRYOUT_RESPONSE_SELECTION_INVALID",
    ]),
    message: Schema.String,
  }
) {}

export const TryoutResponseSelectionErrorWire = failureWire(
  TryoutResponseSelectionError
);
/** Stable corruption detected across response, placement, and attempt rows. */
export class TryoutResponseIntegrityError
  extends Schema.TaggedError<TryoutResponseIntegrityError>()(
    "TryoutResponseIntegrityError",
    {
      code: Schema.Literals([
        "TRYOUT_PLACEMENT_COUNT_MISMATCH",
        "TRYOUT_PLACEMENT_DUPLICATE",
        "TRYOUT_RESPONSE_SELECTION_MISMATCH",
        "TRYOUT_RESPONSE_COUNT_EXCEEDED",
        "TRYOUT_RESPONSE_LINK_MISMATCH",
        "TRYOUT_RESPONSE_PLACEMENT_DUPLICATE",
        "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
      ]),
      message: Schema.String,
    }
  )
  implements ConvexTaggedError {}
export const TryoutResponseIntegrityErrorWire = failureWire(
  TryoutResponseIntegrityError
);
