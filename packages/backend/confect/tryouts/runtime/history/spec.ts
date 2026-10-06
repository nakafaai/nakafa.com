import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import {
  tryoutAnswerSelectorValidator,
  tryoutQuestionSelectorValidator,
} from "@repo/backend/confect/tryouts/runtime/spec";
import { Schema } from "effect";

/** Bounded exact selectors requested under the current user's attempt. */
export const tryoutHistoryRequestValidator = Schema.Struct({
  attemptId: IdSchema("tryoutAttempts"),
  selectors: Schema.mutable(
    Schema.Array(
      Schema.Union([
        tryoutQuestionSelectorValidator,
        tryoutAnswerSelectorValidator,
      ])
    )
  ),
});
export type TryoutHistoryRequest = typeof tryoutHistoryRequestValidator.Type;

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
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
