import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { getLatestScaleVersionForTryout } from "@repo/backend/confect/modules/tryout/irtScaleRead.service";
import { TryoutError } from "@repo/backend/confect/modules/tryout/tryout.errors";
import { Effect } from "effect";

/** Resolves the scoring scale that should be used for a tryout attempt. */
export const getTryoutScoreTarget = Effect.fn(
  "tryouts.irt.getTryoutScoreTarget"
)(function* (tryoutAttempt: {
  readonly scaleVersionId: Doc<"tryoutAttempts">["scaleVersionId"];
  readonly tryoutId: Doc<"tryoutAttempts">["tryoutId"];
}) {
  const reader = yield* DatabaseReader;
  const currentScaleVersion = yield* reader
    .table("irtScaleVersions")
    .get(tryoutAttempt.scaleVersionId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  const latestScaleVersion = yield* getLatestScaleVersionForTryout(
    tryoutAttempt.tryoutId
  );

  if (!currentScaleVersion) {
    return yield* Effect.fail(
      new TryoutError({
        code: "INVALID_ATTEMPT_STATE",
        message: "Tryout attempt is missing its scoring scale.",
      })
    );
  }

  if (!latestScaleVersion || latestScaleVersion.status !== "official") {
    return {
      scaleVersionId: currentScaleVersion._id,
      scoreStatus: currentScaleVersion.status,
    };
  }

  return {
    scaleVersionId: latestScaleVersion._id,
    scoreStatus: "official" as const,
  };
});

/** Converts exercise answers and scale items into operational IRT responses. */
export function buildOperationalIrtResponses(args: {
  readonly answers: readonly Doc<"exerciseAnswers">[];
  readonly itemParamsRecords: readonly Doc<"irtScaleVersionItems">[];
}) {
  const answersByQuestionId = new Map(
    args.answers.flatMap((answer) => {
      if (!answer.questionId) {
        return [];
      }

      return [[answer.questionId, answer] as const];
    })
  );

  return args.itemParamsRecords.map((itemParams) => ({
    correct: answersByQuestionId.get(itemParams.questionId)?.isCorrect ?? false,
    params: {
      difficulty: itemParams.difficulty,
      discrimination: itemParams.discrimination,
    },
  }));
}
