import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getProvisionalParams } from "@repo/backend/convex/irt/estimation";
import { IRT_OPERATIONAL_MODEL } from "@repo/backend/convex/irt/policy";
import type { ScaleVersionItemSnapshot } from "@repo/backend/convex/irt/scales/read";
import { getAll, getManyFrom } from "convex-helpers/server/relationships";

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

/** Builds a provisional frozen scale from current item params and bootstrap defaults. */
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
  const [tryout, tryoutPartSets] = await Promise.all([
    db.get("tryouts", tryoutId),
    getManyFrom(
      db,
      "tryoutPartSets",
      "by_tryoutId_and_partIndex",
      tryoutId,
      "tryoutId"
    ),
  ]);

  if (!tryout || tryoutPartSets.length === 0) {
    return null;
  }

  const sets = await getAll(
    db,
    "exerciseSets",
    tryoutPartSets.map((partSet) => partSet.setId)
  );
  const items: ScaleVersionItemSnapshot[] = [];

  for (const [index, partSet] of tryoutPartSets.entries()) {
    const set = sets[index];

    if (!set) {
      return null;
    }

    const [questions, existingParams] = await Promise.all([
      getManyFrom(db, "exerciseQuestions", "by_setId", partSet.setId, "by_setId"),
      getManyFrom(
        db,
        "exerciseItemParameters",
        "by_setId",
        partSet.setId,
        "by_setId"
      ),
    ]);

    if (questions.length === 0) {
      return null;
    }

    const paramsByQuestionId = new Map(
      existingParams.map((params) => [params.questionId, params])
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
