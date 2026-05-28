import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { IrtError } from "@repo/backend/confect/modules/tryout/irt.errors";
import { loadValidatedTryoutPartSets } from "@repo/backend/confect/modules/tryout/tryoutParts.service";
import { Effect } from "effect";

/** Loads the validated exercise sets that make up a tryout scale. */
export const loadValidatedScaleTryoutSets = Effect.fn(
  "irt.scales.loadValidatedScaleTryoutSets"
)(function* (tryout: Doc<"tryouts">) {
  const reader = yield* DatabaseReader;
  const tryoutPartSets = yield* loadValidatedTryoutPartSets({
    partCount: tryout.partCount,
    tryoutId: tryout._id,
  });

  return yield* Effect.all(
    tryoutPartSets.map((partSet) =>
      reader
        .table("exerciseSets")
        .get(partSet.setId)
        .pipe(
          Effect.map((set) => ({ partSet, set })),
          Effect.catchTag("GetByIdFailure", () =>
            Effect.fail(
              new IrtError({
                code: "IRT_SET_NOT_FOUND",
                message:
                  "Tryout scale build is missing one of its exercise sets.",
              })
            )
          )
        )
    )
  );
});

/** Loads and validates the questions and item params for one scale set. */
export const loadValidatedScaleSetData = Effect.fn(
  "irt.scales.loadValidatedScaleSetData"
)(function* (set: Doc<"exerciseSets">) {
  const reader = yield* DatabaseReader;
  const [questions, itemParams] = yield* Effect.all([
    reader
      .table("exerciseQuestions")
      .index("by_setId", (query) => query.eq("setId", set._id))
      .take(set.questionCount + 1),
    reader
      .table("exerciseItemParameters")
      .index("by_setId", (query) => query.eq("setId", set._id))
      .take(set.questionCount + 1),
  ]);

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
