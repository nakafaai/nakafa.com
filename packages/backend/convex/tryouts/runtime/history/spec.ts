import {
  tryoutAnswerSelectorValidator,
  tryoutQuestionSelectorValidator,
} from "@repo/backend/convex/tryouts/runtime/content";
import { type Infer, v } from "convex/values";
import { Schema } from "effect";

/** Bounded exact selectors requested under the current user's attempt. */
export const tryoutHistoryRequestValidator = v.object({
  attemptId: v.id("tryoutAttempts"),
  selectors: v.array(
    v.union(tryoutQuestionSelectorValidator, tryoutAnswerSelectorValidator)
  ),
});

export type TryoutHistoryRequest = Infer<typeof tryoutHistoryRequestValidator>;

/** An owned content read failed its immutable identity or transport bound. */
export class TryoutHistoryError extends Schema.TaggedError<TryoutHistoryError>()(
  "TryoutHistoryError",
  {
    code: Schema.Literals([
      "TRYOUT_HISTORY_INTEGRITY",
      "TRYOUT_HISTORY_REQUEST_INVALID",
      "TRYOUT_HISTORY_RESPONSE_TOO_LARGE",
    ]),
    message: Schema.String,
  }
) {}
