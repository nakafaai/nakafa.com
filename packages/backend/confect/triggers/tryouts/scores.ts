import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { captureProductEvent } from "@repo/backend/confect/analytics/capture";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import { readAttemptSetIdentity } from "@repo/backend/confect/tryouts/runtime/lookup";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { Change } from "convex-helpers/server/triggers";
import { Effect, flow, Schema } from "effect";

const tryoutScoreAnalyticsFailedCode = "TRYOUT_SCORE_ANALYTICS_FAILED";

/** Raised when a completed-score event cannot resolve its immutable graph. */
class TryoutScoreAnalyticsError extends Schema.TaggedError<TryoutScoreAnalyticsError>()(
  "TryoutScoreAnalyticsError",
  {
    code: Schema.Literal(tryoutScoreAnalyticsFailedCode),
    message: Schema.String,
  }
) {}

/** Maps trigger reads and analytics scheduling into one typed error channel. */
function toTryoutScoreAnalyticsError(error: unknown) {
  return new TryoutScoreAnalyticsError({
    code: tryoutScoreAnalyticsFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/** Captures one event from the score row that canonically ends an attempt. */
export const tryoutScoresHandler = Effect.fn(
  "triggers.tryouts.captureTryoutScoreEvent"
)(
  function* (change: Change<DataModel, "tryoutScores">) {
    const database = yield* DatabaseReader;
    if (change.operation !== "insert") {
      return;
    }
    const score = change.newDoc;
    const attempt = yield* database
      .table("tryoutAttempts")
      .get(score.tryoutAttemptId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!attempt) {
      return yield* toTryoutScoreAnalyticsError(
        "A completed try-out score is missing its attempt."
      );
    }
    const identity = readAttemptSetIdentity(attempt);
    yield* captureProductEvent({
      distinctId: score.userId,
      event: {
        name: "tryout attempt completed",
        properties: {
          attempt_number: attempt.attemptNumber,
          country_key: identity.countryKey,
          exam_key: identity.examKey,
          locale: identity.locale,
          score_status: score.scoreStatus,
          set_key: identity.setKey,
          total_questions: score.totalQuestions,
          track_key: identity.trackKey,
        },
      },
      timestamp: new Date(score.finalizedAt),
    });
  },
  Effect.catchDefect(flow(toTryoutScoreAnalyticsError, Effect.fail))
);
