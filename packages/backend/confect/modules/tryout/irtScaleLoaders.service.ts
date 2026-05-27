import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { IrtError } from "@repo/backend/confect/modules/tryout/irt.errors";
import { loadValidatedTryoutPartSets } from "@repo/backend/confect/modules/tryout/tryoutParts.service";
import { getAll } from "convex-helpers/server/relationships";
import { Effect } from "effect";

/** Loads the validated exercise sets that make up a tryout scale. */
export const loadValidatedScaleTryoutSets = Effect.fn(
  "irt.scales.loadValidatedScaleTryoutSets"
)(function* (db: ConvexMutationCtx["db"], tryout: Doc<"tryouts">) {
  const tryoutPartSets = yield* loadValidatedTryoutPartSets(db, {
    partCount: tryout.partCount,
    tryoutId: tryout._id,
  });
  const sets = yield* Effect.promise(() =>
    getAll(
      db,
      "exerciseSets",
      tryoutPartSets.map((partSet) => partSet.setId)
    )
  );

  return yield* Effect.all(
    tryoutPartSets.map((partSet, index) => {
      const set = sets[index];

      if (!set) {
        return Effect.fail(
          new IrtError({
            code: "IRT_SET_NOT_FOUND",
            message: "Tryout scale build is missing one of its exercise sets.",
          })
        );
      }

      return Effect.succeed({ partSet, set });
    })
  );
});

/** Loads and validates the questions and item params for one scale set. */
export const loadValidatedScaleSetData = Effect.fn(
  "irt.scales.loadValidatedScaleSetData"
)(function* (db: ConvexMutationCtx["db"], set: Doc<"exerciseSets">) {
  const [questions, itemParams] = yield* Effect.promise(() =>
    Promise.all([
      db
        .query("exerciseQuestions")
        .withIndex("by_setId", (query) => query.eq("setId", set._id))
        .take(set.questionCount + 1),
      db
        .query("exerciseItemParameters")
        .withIndex("by_setId", (query) => query.eq("setId", set._id))
        .take(set.questionCount + 1),
    ])
  );

  if (questions.length > set.questionCount) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_QUESTION_COUNT_EXCEEDED",
        message: "Exercise question count exceeds the set question count.",
      })
    );
  }

  if (itemParams.length <= set.questionCount) {
    return { itemParams, questions };
  }

  return yield* Effect.fail(
    new IrtError({
      code: "IRT_ITEM_PARAMETER_COUNT_EXCEEDED",
      message: "Exercise item parameter count exceeds the set question count.",
    })
  );
});
