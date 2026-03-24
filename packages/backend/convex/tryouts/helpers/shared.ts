import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { ConvexError } from "convex/values";

export type TryoutMutationCtx = Pick<MutationCtx, "db" | "scheduler">;
type TryoutDbReader = QueryCtx["db"];
type TryoutAnswerLoaderDb = QueryCtx["db"] | MutationCtx["db"];

/** Pick the most recent in-progress part to resume within one tryout. */
export function pickSuggestedPartKey<
  PartAttempt extends {
    partKey: Doc<"tryoutPartAttempts">["partKey"];
    setAttempt: Pick<Doc<"exerciseAttempts">, "lastActivityAt" | "status">;
  },
>(partAttempts: PartAttempt[]) {
  let suggestedPartKey: PartAttempt["partKey"] | undefined;
  let latestActivityAt = Number.NEGATIVE_INFINITY;

  for (const partAttempt of partAttempts) {
    if (partAttempt.setAttempt.status !== "in-progress") {
      continue;
    }

    if (partAttempt.setAttempt.lastActivityAt <= latestActivityAt) {
      continue;
    }

    suggestedPartKey = partAttempt.partKey;
    latestActivityAt = partAttempt.setAttempt.lastActivityAt;
  }

  return suggestedPartKey;
}

/** Load all persisted part attempts for one tryout within the known part bound. */
export async function loadBoundedTryoutPartAttempts(
  db: TryoutDbReader | MutationCtx["db"],
  {
    partCount,
    tryoutAttemptId,
  }: {
    partCount: Doc<"tryouts">["partCount"];
    tryoutAttemptId: Doc<"tryoutAttempts">["_id"];
  }
) {
  const partAttempts = await db
    .query("tryoutPartAttempts")
    .withIndex("by_tryoutAttemptId_and_partIndex", (q) =>
      q.eq("tryoutAttemptId", tryoutAttemptId)
    )
    .take(partCount + 1);

  if (partAttempts.length <= partCount) {
    return partAttempts;
  }

  throw new ConvexError({
    code: "INVALID_ATTEMPT_STATE",
    message: "Tryout attempt has more part attempts than expected.",
  });
}

/** Load all exercise answers for one set attempt, bounded by total exercises. */
export async function getBoundedExerciseAnswers(
  db: TryoutAnswerLoaderDb,
  {
    attemptId,
    totalExercises,
  }: {
    attemptId: Doc<"exerciseAttempts">["_id"];
    totalExercises: Doc<"exerciseAttempts">["totalExercises"];
  }
) {
  const answers = await db
    .query("exerciseAnswers")
    .withIndex("by_attemptId_and_exerciseNumber", (q) =>
      q.eq("attemptId", attemptId)
    )
    .take(totalExercises + 1);

  if (answers.length <= totalExercises) {
    return answers;
  }

  throw new ConvexError({
    code: "TRYOUT_ANSWER_COUNT_EXCEEDED",
    message: "Exercise answer count exceeds the attempt total exercises.",
  });
}

/** Count how many persisted answers are marked correct. */
export function countCorrectAnswers(answers: Doc<"exerciseAnswers">[]) {
  return answers.reduce(
    (correctCount, answer) => correctCount + (answer.isCorrect ? 1 : 0),
    0
  );
}
