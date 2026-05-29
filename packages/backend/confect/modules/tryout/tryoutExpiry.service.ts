import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { ExerciseAttempts } from "@repo/backend/confect/modules/learning/exercises.tables";
import { TryoutError } from "@repo/backend/confect/modules/tryout/tryout.errors";
import { syncTryoutAttemptAggregates } from "@repo/backend/confect/modules/tryout/tryoutFinalizeAggregates.service";
import { finalizeTryoutPartAttempt } from "@repo/backend/confect/modules/tryout/tryoutFinalizePart.service";
import { getTryoutScoreTarget } from "@repo/backend/confect/modules/tryout/tryoutIrt.service";
import { loadBoundedTryoutPartAttempts } from "@repo/backend/confect/modules/tryout/tryoutLoaders.service";
import type { TryoutAttempts } from "@repo/backend/confect/modules/tryout/tryouts.tables";
import { Effect, Option } from "effect";

type ExerciseAttemptDoc = typeof ExerciseAttempts.Doc.Type;
type TryoutAttemptDoc = typeof TryoutAttempts.Doc.Type;

/** Expires a tryout attempt and finalizes every unfinished part. */
export const expireTryoutAttempt = Effect.fnUntraced(function* (
  tryoutAttempt: TryoutAttemptDoc,
  now: number
) {
  const reader = yield* DatabaseReader;
  const expiredAtMs = tryoutAttempt.expiresAt;
  const scoreTarget = yield* getTryoutScoreTarget(tryoutAttempt);
  const tryout = yield* reader
    .table("tryouts")
    .get(tryoutAttempt.tryoutId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!tryout) {
    return yield* Effect.fail(
      new TryoutError({
        code: "TRYOUT_NOT_FOUND",
        message: "Tryout not found.",
      })
    );
  }

  const partAttempts = yield* loadBoundedTryoutPartAttempts({
    partCount: tryoutAttempt.partSetSnapshots.length,
    tryoutAttemptId: tryoutAttempt._id,
  });

  for (const partAttempt of partAttempts) {
    if (tryoutAttempt.completedPartIndices.includes(partAttempt.partIndex)) {
      continue;
    }

    yield* finalizeTryoutPartAttempt({
      finishedAtMs: expiredAtMs,
      now,
      partAttempt,
      status: "expired",
      tryoutAttemptId: tryoutAttempt._id,
    });
  }

  yield* syncTryoutAttemptAggregates({
    completedAtMs: expiredAtMs,
    now,
    scaleVersionId: scoreTarget.scaleVersionId,
    scoreStatus: scoreTarget.scoreStatus,
    status: "expired",
    tryoutAttemptId: tryoutAttempt._id,
  });

  return expiredAtMs;
});

/** Synchronizes the persisted expired state when the tryout deadline has passed. */
export const syncTryoutAttemptExpiry = Effect.fnUntraced(function* (
  tryoutAttempt: TryoutAttemptDoc,
  now: number
) {
  const expiredAtMs = tryoutAttempt.expiresAt;

  if (tryoutAttempt.status === "expired") {
    return { expired: true, expiredAtMs };
  }

  if (tryoutAttempt.status === "in-progress" && now >= expiredAtMs) {
    yield* expireTryoutAttempt(tryoutAttempt, now);
    return { expired: true, expiredAtMs };
  }

  return { expired: false, expiredAtMs };
});

/** Synchronizes tryout expiry for an exercise attempt owned by a tryout part. */
export const syncTryoutExerciseAttemptExpiry = Effect.fnUntraced(function* (
  attempt: ExerciseAttemptDoc,
  now: number
) {
  if (attempt.origin !== "tryout") {
    return { expired: false, expiredAtMs: undefined };
  }

  const reader = yield* DatabaseReader;
  const partAttempt = yield* reader
    .table("tryoutPartAttempts")
    .index("by_setAttemptId", (query) => query.eq("setAttemptId", attempt._id))
    .first()
    .pipe(Effect.map(Option.getOrNull));

  if (!partAttempt) {
    return yield* Effect.fail(
      new TryoutError({
        code: "INVALID_ATTEMPT_STATE",
        message: "Tryout exercise attempt is missing its part attempt mapping.",
      })
    );
  }

  const tryoutAttempt = yield* reader
    .table("tryoutAttempts")
    .get(partAttempt.tryoutAttemptId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!tryoutAttempt) {
    return yield* Effect.fail(
      new TryoutError({
        code: "INVALID_ATTEMPT_STATE",
        message:
          "Tryout exercise attempt is missing its parent tryout attempt.",
      })
    );
  }

  return yield* syncTryoutAttemptExpiry(tryoutAttempt, now);
});
