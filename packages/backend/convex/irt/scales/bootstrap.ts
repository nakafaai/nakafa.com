import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getProvisionalParams } from "@repo/backend/convex/irt/estimation";
import { IRT_OPERATIONAL_MODEL } from "@repo/backend/convex/irt/policy";
import {
  loadValidatedScaleSetData,
  loadValidatedScaleTryoutSets,
} from "@repo/backend/convex/irt/scales/loaders";
import type { ScaleVersionItemSnapshot } from "@repo/backend/convex/irt/scales/read";

type IrtDbWriter = MutationCtx["db"];

function createBootstrapCalibrationRun(
  db: IrtDbWriter,
  {
    now,
    questionCount,
    setId,
  }: {
    now: number;
    questionCount: number;
    setId: Id<"exerciseSets">;
  }
) {
  return db.insert("irtCalibrationRuns", {
    setId,
    model: IRT_OPERATIONAL_MODEL,
    status: "completed",
    questionCount,
    responseCount: 0,
    attemptCount: 0,
    iterationCount: 0,
    maxParameterDelta: 0,
    startedAt: now,
    updatedAt: now,
    completedAt: now,
  });
}

/**
 * Build a provisional frozen scale from current item parameters and bootstrap
 * defaults when a tryout does not yet qualify for a fully calibrated official
 * snapshot.
 */
export async function buildBootstrapScaleItems(
  db: IrtDbWriter,
  {
    now,
    tryoutId,
  }: {
    now: number;
    tryoutId: Id<"tryouts">;
  }
) {
  const tryout = await db.get("tryouts", tryoutId);

  if (!tryout) {
    return null;
  }

  const tryoutSets = await loadValidatedScaleTryoutSets(db, tryout);

  if (tryoutSets.length === 0) {
    return null;
  }

  const items: ScaleVersionItemSnapshot[] = [];

  for (const { partSet, set } of tryoutSets) {
    const { itemParams, questions } = await loadValidatedScaleSetData(db, set);

    if (questions.length === 0) {
      return null;
    }

    const paramsByQuestionId = new Map(
      itemParams.map((params) => [params.questionId, params])
    );
    const bootstrapRunId = await createBootstrapCalibrationRun(db, {
      now,
      questionCount: questions.length,
      setId: partSet.setId,
    });

    for (const question of questions) {
      const params = paramsByQuestionId.get(question._id);
      const provisional = getProvisionalParams();

      items.push({
        questionId: question._id,
        setId: partSet.setId,
        difficulty: params?.difficulty ?? provisional.difficulty,
        discrimination: params?.discrimination ?? provisional.discrimination,
        calibrationRunId: params?.calibrationRunId ?? bootstrapRunId,
      });
    }
  }

  return items;
}
