import { publicFailure } from "@repo/backend/confect/failure";
import { Schema } from "effect";

const runtimeFailureMessage = "Unable to complete try-out runtime operation.";

/** Expected failure while executing one try-out runtime capability. */
export class TryoutRuntimeError extends Schema.TaggedError<TryoutRuntimeError>()(
  "TryoutRuntimeError",
  {
    cause: Schema.optional(Schema.Unknown),
    code: Schema.Literals([
      "TRYOUT_RUNTIME_FAILED",
      "TRYOUT_PROGRESS_ATTEMPT_MISMATCH",
      "TRYOUT_SECTION_ATTEMPT_COUNT_EXCEEDED",
      "TRYOUT_SECTION_SNAPSHOT_MISMATCH",
      "TRYOUT_SCORE_SOURCE_MISMATCH",
      "TRYOUT_HISTORY_SCALE_MISSING",
      "TRYOUT_ENTRY_SECTION_NOT_FOUND",
      "TRYOUT_SECTION_ALREADY_FINISHED",
      "TRYOUT_SECTION_IN_PROGRESS",
      "TRYOUT_SCORE_ESTIMATE_INCOMPLETE",
      "TRYOUT_IRT_CALIBRATION_RUN_MISMATCH",
      "TRYOUT_IRT_SCALE_REQUIRED",
      "TRYOUT_IRT_SCALE_COUNT_MISMATCH",
      "TRYOUT_IRT_ITEM_COUNT_MISMATCH",
      "TRYOUT_IRT_ITEM_DUPLICATE",
      "TRYOUT_IRT_ITEM_STALE",
      "TRYOUT_IRT_ITEM_INVALID",
      "TRYOUT_IRT_INFORMATION_TOO_LOW",
    ]),
    message: Schema.String,
  }
) {}

/** Maps an unknown runtime failure into the stable typed error channel. */
export const TryoutRuntimeErrorWire = publicFailure(TryoutRuntimeError);
export function toTryoutRuntimeError(error: unknown) {
  return TryoutRuntimeError.make({
    cause: error,
    code: "TRYOUT_RUNTIME_FAILED",
    message: runtimeFailureMessage,
  });
}
