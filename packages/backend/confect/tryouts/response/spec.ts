import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Version } from "@repo/backend/confect/assessment/gate/rules";
import { ExamResponse } from "@repo/backend/confect/assessment/response";
import { publicFailure } from "@repo/backend/confect/failure";
import { Schema } from "effect";
export const saveTryoutResponseArgsValidator = Schema.Struct({
  placementId: IdSchema("tryoutAttemptPlacements"),
  /** The learner's response to the question's one interaction, or `null` to clear the answer. */
  response: Schema.Union([ExamResponse, Schema.Null]),
  /**
   * Numbers the writes of one question, so a write another one overtook is
   * refused.
   */
  version: Version,
});
export type SaveTryoutResponseArgs =
  typeof saveTryoutResponseArgsValidator.Type;
export const saveTryoutResponseResultValidator = Schema.Null;

/** One question of the caller's running section, flagged to come back to or unflagged. */
export const tryoutFlagArgsValidator = Schema.Struct({
  flagged: Schema.Boolean,
  placementId: IdSchema("tryoutAttemptPlacements"),
});
export type TryoutFlagArgs = typeof tryoutFlagArgsValidator.Type;

/** Expected failure while saving one selected try-out response. */
export class TryoutResponseError extends Schema.TaggedError<TryoutResponseError>()(
  "TryoutResponseError",
  {
    cause: Schema.optional(Schema.Unknown),
    code: Schema.Literals([
      "TRYOUT_RESPONSE_FAILED",
      "TRYOUT_PLACEMENT_NOT_FOUND",
      "TRYOUT_EXPIRED",
      "TRYOUT_RESPONSE_STALE",
    ]),
    message: Schema.String,
  }
) {}
export const TryoutResponseErrorWire = publicFailure(TryoutResponseError);
/** Redacts unexpected storage failures while retaining the internal cause. */
export function toTryoutResponseError(error: unknown) {
  return new TryoutResponseError({
    cause: error,
    code: "TRYOUT_RESPONSE_FAILED",
    message: "Unable to save try-out response.",
  });
}
/**
 * A response does not fit its question's frozen interaction (`fitsQuestion`): it holds another kind of
 * answer, or parts the interaction does not have, or more choices than it takes.
 */
export class TryoutResponseUnfitError extends Schema.TaggedError<TryoutResponseUnfitError>()(
  "TryoutResponseUnfitError",
  {
    code: Schema.Literal("TRYOUT_RESPONSE_UNFIT"),
    message: Schema.String,
  }
) {}

/** Stable corruption detected across response, placement, and attempt rows. */
export class TryoutResponseIntegrityError extends Schema.TaggedError<TryoutResponseIntegrityError>()(
  "TryoutResponseIntegrityError",
  {
    code: Schema.Literals([
      "TRYOUT_PLACEMENT_COUNT_MISMATCH",
      "TRYOUT_PLACEMENT_DUPLICATE",
      "TRYOUT_RESPONSE_GRADE_MISMATCH",
      "TRYOUT_RESPONSE_COUNT_EXCEEDED",
      "TRYOUT_RESPONSE_LINK_MISMATCH",
      "TRYOUT_RESPONSE_PLACEMENT_DUPLICATE",
      "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
    ]),
    message: Schema.String,
  }
) {}

/** Creates one typed fail-closed response graph error. */
export function responseIntegrity(
  code: TryoutResponseIntegrityError["code"],
  message: string
) {
  return new TryoutResponseIntegrityError({
    code,
    message,
  });
}
