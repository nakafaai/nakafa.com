import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { captureProductEvent } from "@repo/backend/convex/analytics/capture";
import {
  getUnknownErrorMessage,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";
import { Effect, Schema } from "effect";

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
const captureTryoutScoreEvent = Effect.fn(
  "triggers.tryouts.captureTryoutScoreEvent"
)(function* (
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "tryoutScores">
) {
  if (change.operation !== "insert") {
    return;
  }

  const score = change.newDoc;
  const attempt = yield* Effect.tryPromise({
    catch: toTryoutScoreAnalyticsError,
    try: () => ctx.db.get("tryoutAttempts", score.tryoutAttemptId),
  });
  if (!attempt) {
    return yield* Effect.fail(
      toTryoutScoreAnalyticsError(
        "A completed try-out score is missing its attempt."
      )
    );
  }
  const identity = readScoreIdentity(attempt);

  yield* captureProductEvent(ctx, {
    distinctId: score.userId,
    event: {
      name: "tryout attempt completed",
      properties: {
        attempt_number: attempt.attemptNumber,
        country_key: identity.countryKey,
        exam_key: identity.examKey,
        locale: identity.locale,
        raw_score_percentage: score.rawScore,
        score_status: score.scoreStatus,
        set_key: identity.setKey,
        theta: score.theta,
        total_correct: score.totalCorrect,
        total_questions: score.totalQuestions,
        track_key: identity.trackKey,
      },
    },
    timestamp: new Date(score.finalizedAt),
  }).pipe(Effect.mapError(toTryoutScoreAnalyticsError));
});

/** Reads analytics identity from the immutable signed attempt. */
function readScoreIdentity(attempt: DataModel["tryoutAttempts"]["document"]) {
  return {
    countryKey: attempt.countryKey,
    examKey: attempt.examKey,
    locale: attempt.locale,
    setKey: attempt.setKey,
    trackKey: attempt.trackKey,
  };
}

/** Runs completed-score analytics at the registered Convex trigger boundary. */
export async function tryoutScoresHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "tryoutScores">
) {
  await runConvexProgram(captureTryoutScoreEvent(ctx, change));
}
