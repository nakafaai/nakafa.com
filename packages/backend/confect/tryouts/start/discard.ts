import type { Docs } from "@repo/backend/confect/_generated/docs";
import type { Id } from "@repo/backend/confect/_generated/id";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { TryoutAttemptStateError } from "@repo/backend/confect/tryouts/attempt";
import { writeTryoutSetProgress } from "@repo/backend/confect/tryouts/progress/write";
import { loadAttemptSections } from "@repo/backend/confect/tryouts/runtime/attempt/sections";
import { toTryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import { readOwnedAttemptById } from "@repo/backend/confect/tryouts/runtime/lookup";
import { loadAttemptPlacements } from "@repo/backend/confect/tryouts/runtime/placement";
import { loadAttemptScoreResult } from "@repo/backend/confect/tryouts/score/result";
import { Array as Arr, Effect, Option } from "effect";

/** Restores set progress to the prior attempt, or deletes it when no prior attempt exists. */
const restoreSetProgress = Effect.fn("tryouts.start.restoreSetProgress")(
  function* (attempt: Docs["tryoutAttempts"], now: number) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const progress = yield* reader
      .table("tryoutSetProgress")
      .get(
        "by_userId_and_set",
        attempt.userId,
        attempt.countryKey,
        attempt.examKey,
        attempt.trackKey,
        attempt.setKey
      )
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.mapError(toTryoutRuntimeError)
      );
    if (progress?.latestAttemptId !== attempt._id) {
      return;
    }
    yield* writer
      .table("tryoutSetProgress")
      .delete(progress._id)
      .pipe(Effect.mapError(toTryoutRuntimeError));
    const prior = yield* reader
      .table("tryoutAttempts")
      .index(
        "by_userId_and_set_and_attemptNumber",
        (index) =>
          index
            .eq("userId", attempt.userId)
            .eq("countryKey", attempt.countryKey)
            .eq("examKey", attempt.examKey)
            .eq("trackKey", attempt.trackKey)
            .eq("setKey", attempt.setKey),
        "desc"
      )
      .first()
      .pipe(Effect.mapError(toTryoutRuntimeError));
    if (Option.isNone(prior)) {
      return;
    }
    const score = yield* loadAttemptScoreResult(prior.value);
    if (score === null) {
      return;
    }
    yield* writeTryoutSetProgress({
      attempt: prior.value,
      publishedScore: score.publishedScore,
      status: prior.value.status,
      updatedAt: now,
    });
  }
);

/**
 * Discards an in-progress attempt whose learner has not started any section yet. Deletes its frozen
 * placements and attempt row atomically, then restores or removes its set progress row. Scheduled
 * expiry and reminder jobs check row existence and no-op once the attempt is gone.
 */
export const discardUnstartedAttempt = Effect.fn(
  "tryouts.start.discardUnstartedAttempt"
)(function* (input: {
  readonly attemptId: Id<"tryoutAttempts">;
  readonly now: number;
  readonly userId: Id<"users">;
}) {
  const attempt = yield* readOwnedAttemptById(input.attemptId, input.userId);
  if (!attempt) {
    return yield* new TryoutAttemptStateError({
      code: "TRYOUT_ATTEMPT_NOT_FOUND",
      message: "Try-out attempt not found.",
    });
  }
  if (attempt.status !== "in-progress") {
    return yield* new TryoutAttemptStateError({
      code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
      message: "Only an active try-out attempt can be discarded.",
    });
  }
  const sections = yield* loadAttemptSections(attempt);
  if (Arr.isReadonlyArrayNonEmpty(sections)) {
    return yield* new TryoutAttemptStateError({
      code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
      message: "A try-out attempt cannot be discarded after a section starts.",
    });
  }
  const placements = yield* loadAttemptPlacements(attempt);
  const writer = yield* DatabaseWriter;
  yield* Effect.forEach(
    placements,
    (placement) =>
      writer
        .table("tryoutAttemptPlacements")
        .delete(placement._id)
        .pipe(Effect.mapError(toTryoutRuntimeError)),
    { concurrency: "unbounded", discard: true }
  );
  yield* writer
    .table("tryoutAttempts")
    .delete(attempt._id)
    .pipe(Effect.mapError(toTryoutRuntimeError));
  yield* restoreSetProgress(attempt, input.now);
  return { discarded: true as const };
});
