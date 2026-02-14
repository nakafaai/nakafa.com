import type {
  DataModel,
  Doc,
  Id,
} from "@repo/backend/convex/_generated/dataModel";
import { applyAttemptAggregatesDelta } from "@repo/backend/convex/exercises/utils";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

/**
 * Trigger handler for exerciseAnswers table changes.
 *
 * Updates exercise attempt aggregates when answers are added, modified, or removed:
 * - Tracks total answered count, correct answers, and time spent
 * - Handles attempt transfers (when answer moves to different attempt)
 * - Uses delta calculations for idempotent updates
 *
 * @param ctx - The Convex mutation context with database access
 * @param change - The change object containing operation details and document state
 */
export async function exerciseAnswersHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "exerciseAnswers">
) {
  const now = Date.now();
  const answer = change.newDoc;
  const oldAnswer = change.oldDoc;

  const applyDelta = async ({
    attemptId,
    deltaAnsweredCount,
    deltaCorrectAnswers,
    deltaTotalTime,
  }: {
    attemptId: Id<"exerciseAttempts">;
    deltaAnsweredCount: number;
    deltaCorrectAnswers: number;
    deltaTotalTime: number;
  }) => {
    const attempt = await ctx.db.get("exerciseAttempts", attemptId);
    if (!attempt) {
      return;
    }

    const next = applyAttemptAggregatesDelta({
      attempt,
      deltaAnsweredCount,
      deltaCorrectAnswers,
      deltaTotalTime,
    });

    await ctx.db.patch("exerciseAttempts", attemptId, {
      ...next,
      lastActivityAt: now,
      updatedAt: now,
    });
  };

  const toDelta = (doc: Doc<"exerciseAnswers">) => ({
    deltaAnsweredCount: 1,
    deltaCorrectAnswers: doc.isCorrect ? 1 : 0,
    deltaTotalTime: doc.timeSpent,
  });

  const toNegativeDelta = (doc: Doc<"exerciseAnswers">) => ({
    deltaAnsweredCount: -1,
    deltaCorrectAnswers: doc.isCorrect ? -1 : 0,
    deltaTotalTime: -doc.timeSpent,
  });

  switch (change.operation) {
    case "insert": {
      if (!answer) {
        break;
      }
      await applyDelta({ attemptId: answer.attemptId, ...toDelta(answer) });
      break;
    }

    case "update": {
      if (!(answer && oldAnswer)) {
        break;
      }

      if (answer.attemptId !== oldAnswer.attemptId) {
        await applyDelta({
          attemptId: oldAnswer.attemptId,
          ...toNegativeDelta(oldAnswer),
        });
        await applyDelta({ attemptId: answer.attemptId, ...toDelta(answer) });
        break;
      }

      const deltaCorrectAnswers =
        (answer.isCorrect ? 1 : 0) - (oldAnswer.isCorrect ? 1 : 0);
      const deltaTotalTime = answer.timeSpent - oldAnswer.timeSpent;

      await applyDelta({
        attemptId: answer.attemptId,
        deltaAnsweredCount: 0,
        deltaCorrectAnswers,
        deltaTotalTime,
      });
      break;
    }

    case "delete": {
      if (!oldAnswer) {
        break;
      }
      await applyDelta({
        attemptId: oldAnswer.attemptId,
        ...toNegativeDelta(oldAnswer),
      });
      break;
    }

    default: {
      break;
    }
  }
}
