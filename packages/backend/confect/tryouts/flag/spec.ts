import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { publicFailure } from "@repo/backend/confect/failure";
import { Schema } from "effect";

export const setTryoutFlagArgsValidator = Schema.Struct({
  placementId: IdSchema("tryoutAttemptPlacements"),
  flagged: Schema.Boolean,
});
export type SetTryoutFlagArgs = Schema.Schema.Type<
  typeof setTryoutFlagArgsValidator
>;
export const setTryoutFlagResultValidator = Schema.Null;

/** Expected failure while flagging one try-out placement for review. */
export class TryoutFlagError extends Schema.TaggedError<TryoutFlagError>()(
  "TryoutFlagError",
  {
    cause: Schema.optional(Schema.Unknown),
    code: Schema.Literals([
      "TRYOUT_FLAG_FAILED",
      "TRYOUT_PLACEMENT_NOT_FOUND",
      "TRYOUT_EXPIRED",
    ]),
    message: Schema.String,
  }
) {}
export const TryoutFlagErrorWire = publicFailure(TryoutFlagError);

/** Redacts unexpected storage failures while retaining the internal cause. */
export function toTryoutFlagError(error: unknown) {
  return new TryoutFlagError({
    cause: error,
    code: "TRYOUT_FLAG_FAILED",
    message: "Unable to flag try-out question.",
  });
}
