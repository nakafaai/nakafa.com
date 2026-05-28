import type { Id } from "@repo/backend/confect/_generated/dataModel";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { TryoutError } from "@repo/backend/confect/modules/tryout/tryout.errors";
import { Effect } from "effect";

/** Loads bounded part attempts for a tryout attempt. */
export const loadBoundedTryoutPartAttempts = Effect.fn(
  "tryouts.loaders.loadBoundedTryoutPartAttempts"
)(function* (args: {
  readonly partCount: number;
  readonly tryoutAttemptId: Id<"tryoutAttempts">;
}) {
  const reader = yield* DatabaseReader;
  const partAttempts = yield* reader
    .table("tryoutPartAttempts")
    .index("by_tryoutAttemptId_and_partIndex", (query) =>
      query.eq("tryoutAttemptId", args.tryoutAttemptId)
    )
    .take(args.partCount + 1);

  if (partAttempts.length <= args.partCount) {
    return partAttempts;
  }

  return yield* Effect.fail(
    new TryoutError({
      code: "INVALID_ATTEMPT_STATE",
      message: "Tryout attempt has more part attempts than expected.",
    })
  );
});

/** Loads bounded answers for one exercise attempt. */
export const getBoundedExerciseAnswers = Effect.fn(
  "tryouts.loaders.getBoundedExerciseAnswers"
)(function* (args: {
  readonly attemptId: Id<"exerciseAttempts">;
  readonly totalExercises: number;
}) {
  const reader = yield* DatabaseReader;
  const answers = yield* reader
    .table("exerciseAnswers")
    .index("by_attemptId_and_exerciseNumber", (query) =>
      query.eq("attemptId", args.attemptId)
    )
    .take(args.totalExercises + 1);

  if (answers.length <= args.totalExercises) {
    return answers;
  }

  return yield* Effect.fail(
    new TryoutError({
      code: "TRYOUT_ANSWER_COUNT_EXCEEDED",
      message: "Exercise answer count exceeds the attempt total exercises.",
    })
  );
});
