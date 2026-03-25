import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { loadValidatedTryoutPartSets } from "@repo/backend/convex/tryouts/helpers/parts";
import { ConvexError } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";

type IrtDbReader = MutationCtx["db"] | QueryCtx["db"];

/**
 * Load one tryout's part topology and backing exercise sets while enforcing the
 * shared tryout-part invariants used across scale publication paths.
 */
export async function loadValidatedScaleTryoutSets(
  db: IrtDbReader,
  tryout: Pick<Doc<"tryouts">, "_id" | "partCount">
) {
  const tryoutPartSets = await loadValidatedTryoutPartSets(db, {
    partCount: tryout.partCount,
    tryoutId: tryout._id,
  });
  const sets = await getAll(
    db,
    "exerciseSets",
    tryoutPartSets.map((partSet) => partSet.setId)
  );

  return tryoutPartSets.map((partSet, index) => {
    const set = sets[index];

    if (!set) {
      throw new ConvexError({
        code: "IRT_SET_NOT_FOUND",
        message: "Tryout scale build is missing one of its exercise sets.",
      });
    }

    return { partSet, set };
  });
}

/**
 * Load one set's questions and item parameters with count guards derived from
 * the set document itself.
 */
export async function loadValidatedScaleSetData(
  db: IrtDbReader,
  set: Pick<Doc<"exerciseSets">, "_id" | "questionCount">
) {
  const [questions, itemParams] = await Promise.all([
    db
      .query("exerciseQuestions")
      .withIndex("by_setId", (q) => q.eq("setId", set._id))
      .take(set.questionCount + 1),
    db
      .query("exerciseItemParameters")
      .withIndex("by_setId", (q) => q.eq("setId", set._id))
      .take(set.questionCount + 1),
  ]);

  if (questions.length > set.questionCount) {
    throw new ConvexError({
      code: "IRT_QUESTION_COUNT_EXCEEDED",
      message: "Exercise question count exceeds the set question count.",
    });
  }

  if (itemParams.length > set.questionCount) {
    throw new ConvexError({
      code: "IRT_ITEM_PARAMETER_COUNT_EXCEEDED",
      message: "Exercise item parameter count exceeds the set question count.",
    });
  }

  return {
    itemParams,
    questions,
  };
}
