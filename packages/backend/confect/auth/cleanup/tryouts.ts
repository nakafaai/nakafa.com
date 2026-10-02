import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import { reconcileTryoutRuntimeAfterAttempt } from "@repo/backend/confect/contentRelease/tryout/runtime";
import { cleanupAttemptScale } from "@repo/backend/confect/tryouts/runtime/scale";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect, flow, Option } from "effect";

const ATTEMPT_CHILD_BATCH_SIZE = 50;
const PROGRESS_BATCH_SIZE = 25;

/** Deletes one bounded phase from a try-out attempt runtime. */
const cleanupAttemptRuntime = Effect.fn("auth.cleanup.cleanupAttemptRuntime")(
  function* (attempt: Docs["tryoutAttempts"]) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const section = yield* database
      .table("tryoutSectionAttempts")
      .index("by_tryoutAttemptId_and_sectionOrder", (query) =>
        query.eq("tryoutAttemptId", attempt._id)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (section) {
      const responses = yield* database
        .table("tryoutResponses")
        .index("by_tryoutSectionAttemptId_and_answeredAt", (query) =>
          query.eq("tryoutSectionAttemptId", section._id)
        )
        .take(ATTEMPT_CHILD_BATCH_SIZE)
        .pipe(Effect.orDie);
      for (const response of responses) {
        yield* writer.table("tryoutResponses").delete(response._id);
      }
      if (responses.length > 0) {
        return true;
      }
      const flags = yield* database
        .table("tryoutFlags")
        .index("by_tryoutSectionAttemptId", (query) =>
          query.eq("tryoutSectionAttemptId", section._id)
        )
        .take(ATTEMPT_CHILD_BATCH_SIZE)
        .pipe(Effect.orDie);
      for (const flag of flags) {
        yield* writer.table("tryoutFlags").delete(flag._id);
      }
      if (flags.length > 0) {
        return true;
      }
      yield* writer.table("tryoutSectionAttempts").delete(section._id);
      return true;
    }
    const placements = yield* database
      .table("tryoutAttemptPlacements")
      .index("by_tryoutAttemptId_and_questionOrder", (query) =>
        query.eq("tryoutAttemptId", attempt._id)
      )
      .take(ATTEMPT_CHILD_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const placement of placements) {
      yield* writer.table("tryoutAttemptPlacements").delete(placement._id);
    }
    if (placements.length > 0) {
      return true;
    }
    const score = yield* database
      .table("tryoutScores")
      .index("by_tryoutAttemptId", (query) =>
        query.eq("tryoutAttemptId", attempt._id)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (score) {
      yield* writer.table("tryoutScores").delete(score._id);
      return true;
    }
    if (
      yield* cleanupAttemptScale(attempt).pipe(
        Effect.mapError(toUserCleanupError)
      )
    ) {
      return true;
    }
    yield* writer.table("tryoutAttempts").delete(attempt._id);
    yield* reconcileTryoutRuntimeAfterAttempt(attempt.tryoutBundleId).pipe(
      Effect.mapError(toUserCleanupError)
    );
    return true;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Deletes one bounded batch of try-out runtime rows for a user. */
export const cleanupUserTryouts = Effect.fn("auth.cleanup.cleanupUserTryouts")(
  function* (userId: Id<"users">) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const progress = yield* database
      .table("tryoutSetProgress")
      .index("by_userId_and_set", (query) => query.eq("userId", userId))
      .take(PROGRESS_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const row of progress) {
      yield* writer.table("tryoutSetProgress").delete(row._id);
    }
    if (progress.length > 0) {
      return true;
    }
    const attempt = yield* database
      .table("tryoutAttempts")
      .index("by_userId_and_startedAt", (query) => query.eq("userId", userId))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (attempt) {
      return yield* cleanupAttemptRuntime(attempt);
    }
    return false;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
