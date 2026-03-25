import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { getLatestScaleVersionForTryout } from "@repo/backend/convex/irt/scales/read";
import { ConvexError } from "convex/values";

type TryoutDbReader = QueryCtx["db"];
type TryoutScoreTarget = Pick<
  Doc<"tryoutAttempts">,
  "scaleVersionId" | "scoreStatus"
>;

/** Pick the best frozen scale currently available for one tryout attempt. */
export async function getTryoutScoreTarget(
  db: TryoutDbReader,
  tryoutAttempt: Pick<
    Doc<"tryoutAttempts">,
    "_id" | "scaleVersionId" | "tryoutId"
  >
): Promise<TryoutScoreTarget> {
  const [currentScaleVersion, latestScaleVersion] = await Promise.all([
    db.get("irtScaleVersions", tryoutAttempt.scaleVersionId),
    getLatestScaleVersionForTryout(db, tryoutAttempt.tryoutId),
  ]);

  if (!currentScaleVersion) {
    throw new ConvexError({
      code: "INVALID_ATTEMPT_STATE",
      message: "Tryout attempt is missing its scoring scale.",
    });
  }

  if (!latestScaleVersion || latestScaleVersion.status !== "official") {
    return {
      scaleVersionId: currentScaleVersion._id,
      scoreStatus: currentScaleVersion.status,
    };
  }

  return {
    scaleVersionId: latestScaleVersion._id,
    scoreStatus: "official",
  };
}

/**
 * Build the operational person-scoring payload from frozen tryout item params.
 * Unanswered items inside a timed tryout are treated as incorrect.
 */
export function buildOperationalIrtResponses({
  answers,
  itemParamsRecords,
}: {
  answers: Doc<"exerciseAnswers">[];
  itemParamsRecords: Pick<
    Doc<"irtScaleVersionItems">,
    "questionId" | "difficulty" | "discrimination"
  >[];
}) {
  const answersByQuestionId = new Map<
    NonNullable<Doc<"exerciseAnswers">["questionId"]>,
    Doc<"exerciseAnswers">
  >();

  for (const answer of answers) {
    if (!answer.questionId) {
      continue;
    }

    answersByQuestionId.set(answer.questionId, answer);
  }

  return itemParamsRecords.map((itemParams) => ({
    correct: answersByQuestionId.get(itemParams.questionId)?.isCorrect ?? false,
    params: {
      difficulty: itemParams.difficulty,
      discrimination: itemParams.discrimination,
    },
  }));
}
