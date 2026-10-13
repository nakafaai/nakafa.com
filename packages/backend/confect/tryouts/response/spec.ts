import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Version } from "@repo/backend/confect/assessment/gate/rules";
import { publicFailure } from "@repo/backend/confect/failure";
import {
  type ResponseRejected,
  Selection,
} from "@repo/backend/confect/response/model";
import { Schema } from "effect";
export const saveTryoutResponseArgsValidator = Schema.Struct({
  placementId: IdSchema("tryoutAttemptPlacements"),
  selection: Schema.Union([Selection, Schema.Null]),
  /**
   * Numbers the writes of one question, so a write another one overtook is
   * refused.
   *
   * Temporary compatibility, the expand step of packages/backend/AGENTS.md: a
   * browser tab that was opened before versions still sends none, and a
   * required argument would reject every answer of that tab until it reloads.
   * An answer without a version is written as the next one and is never
   * refused as stale. Owner: ADR 0003 and ADR 0013. Exit: the release has been
   * on production for 12 hours, the time the project's skew protection keeps a
   * browser on the web deployment it loaded. Cleanup: make this argument
   * required, make the version of `gate.answer` required, and drop the branch
   * of `numbered` in `assessment/gate/admit.ts` that numbers an answer without
   * one, with its tests.
   */
  version: Schema.optionalKey(Version),
});
export type SaveTryoutResponseArgs =
  typeof saveTryoutResponseArgsValidator.Type;
export const saveTryoutResponseResultValidator = Schema.Null;

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

/** Maps one rejected selection onto the deployed try-out selection error. */
export function toTryoutSelectionError(rejected: ResponseRejected) {
  return rejected.reason === "kind"
    ? new TryoutResponseSelectionError({
        code: "TRYOUT_RESPONSE_KIND_MISMATCH",
        message: "Try-out response kind does not match its frozen question.",
      })
    : new TryoutResponseSelectionError({
        code: "TRYOUT_RESPONSE_SELECTION_INVALID",
        message: "Try-out selection does not belong to this frozen question.",
      });
}
/** Stable corruption detected across response, placement, and attempt rows. */
export class TryoutResponseIntegrityError extends Schema.TaggedError<TryoutResponseIntegrityError>()(
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
