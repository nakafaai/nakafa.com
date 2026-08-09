import type { ConvexTaggedError } from "@repo/backend/convex/lib/effect";
import { readConvexErrorData } from "@repo/backend/convex/lib/effect";
import { type Infer, v } from "convex/values";
import { Schema } from "effect";

export const saveTryoutResponseArgsValidator = v.object({
  placementId: v.id("tryoutAttemptPlacements"),
  selectedOptionId: v.string(),
});

export type SaveTryoutResponseArgs = Infer<
  typeof saveTryoutResponseArgsValidator
>;

export const saveTryoutResponseResultValidator = v.null();

/** Expected failure while saving one selected try-out response. */
export class TryoutResponseError
  extends Schema.TaggedError<TryoutResponseError>()("TryoutResponseError", {
    cause: Schema.optional(Schema.Unknown),
    code: Schema.String,
    message: Schema.String,
  })
  implements ConvexTaggedError
{
  declare readonly code: string;
  declare readonly message: string;
}

/** Maps a thrown Convex operation into the response error channel. */
export function toTryoutResponseError(error: unknown) {
  if (error instanceof TryoutResponseError) {
    return error;
  }

  const data = readConvexErrorData(error);
  if (data) {
    return new TryoutResponseError({ ...data, cause: error });
  }

  return new TryoutResponseError({
    cause: error,
    code: "TRYOUT_RESPONSE_FAILED",
    message: "Unable to save try-out response.",
  });
}
