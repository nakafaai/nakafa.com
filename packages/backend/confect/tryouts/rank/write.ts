import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { setRanks } from "@repo/backend/confect/tryouts/rank/board";
import { toTryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import { Effect, Option } from "effect";

/** Runs one change of the board in the caller's transaction, its failure a try-out runtime failure. */
const onBoard = Effect.fn("tryouts.rank.onBoard")(function* (
  change: (ctx: GenericMutationCtx<DataModel>) => Promise<unknown>
) {
  const ctx = yield* MutationCtx;
  yield* Effect.tryPromise({
    try: () => change(ctx),
    catch: toTryoutRuntimeError,
  });
});

/**
 * Keeps a learner's best score on a set, in the caller's transaction, as an attempt's score is written:
 * the first score of the set enters the board, a higher one replaces it, and any other leaves the board
 * as it stands.
 */
export const recordSetBest = Effect.fn("tryouts.rank.recordSetBest")(function* (
  attempt: Docs["tryoutAttempts"],
  score: {
    readonly finalizedAt: number;
    readonly publishedScore: number;
  }
) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const held = yield* database
    .table("tryoutSetBests")
    .index("by_userId_and_setIdentity", (query) =>
      query.eq("userId", attempt.userId).eq("setIdentity", attempt.setIdentity)
    )
    .first()
    .pipe(Effect.orDie);
  const values = {
    attemptId: attempt._id,
    finalizedAt: score.finalizedAt,
    publishedScore: score.publishedScore,
    setIdentity: attempt.setIdentity,
    userId: attempt.userId,
  };
  if (Option.isNone(held)) {
    const id = yield* writer
      .table("tryoutSetBests")
      .insert(values)
      .pipe(Effect.orDie);
    const best = yield* database
      .table("tryoutSetBests")
      .get(id)
      .pipe(Effect.orDie);
    yield* onBoard((ctx) => setRanks.insert(ctx, best));
    return;
  }
  if (held.value.publishedScore >= score.publishedScore) {
    return;
  }
  yield* writer
    .table("tryoutSetBests")
    .patch(held.value._id, values)
    .pipe(Effect.orDie);
  yield* onBoard((ctx) =>
    setRanks.replace(ctx, held.value, { ...held.value, ...values })
  );
});

/** Takes a learner's bests off their sets' boards, a bounded batch at a time; true while any remained. */
export const deleteSetBests = Effect.fn("tryouts.rank.deleteSetBests")(
  function* (userId: Docs["users"]["_id"], batch: number) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const bests = yield* database
      .table("tryoutSetBests")
      .index("by_userId_and_setIdentity", (query) => query.eq("userId", userId))
      .take(batch)
      .pipe(Effect.orDie);
    for (const best of bests) {
      yield* onBoard((ctx) => setRanks.deleteIfExists(ctx, best));
      yield* writer.table("tryoutSetBests").delete(best._id).pipe(Effect.orDie);
    }
    return bests.length > 0;
  }
);
