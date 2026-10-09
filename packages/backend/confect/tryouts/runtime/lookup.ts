import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  TryoutRuntimeError,
  toTryoutRuntimeError,
} from "@repo/backend/confect/tryouts/runtime/error";
import { getTryoutStatusRank } from "@repo/backend/confect/tryouts/status";
import type { TryoutSetIdentity } from "@repo/backend/content/tryout/set";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { PaginationOptions } from "convex/server";
import { Effect, Option } from "effect";

type UserId = Docs["users"]["_id"];
type TryoutAttempt = Docs["tryoutAttempts"];

/** Finds the active attempt and global numbering across all app languages. */
export const readAttemptStart = Effect.fn("tryouts.runtime.readAttemptStart")(
  function* (identity: TryoutSetIdentity, userId: UserId) {
    const database = yield* DatabaseReader;
    const [activeAttempt, numbered] = yield* Effect.all([
      database
        .table("tryoutAttempts")
        .index(
          "by_userId_and_set_and_status",
          (index) =>
            index
              .eq("userId", userId)
              .eq("countryKey", identity.countryKey)
              .eq("examKey", identity.examKey)
              .eq("trackKey", identity.trackKey)
              .eq("setKey", identity.setKey)
              .eq("status", "in-progress"),
          "desc"
        )
        .first(),
      database
        .table("tryoutAttempts")
        .index(
          "by_userId_and_set_and_attemptNumber",
          (index) =>
            index
              .eq("userId", userId)
              .eq("countryKey", identity.countryKey)
              .eq("examKey", identity.examKey)
              .eq("trackKey", identity.trackKey)
              .eq("setKey", identity.setKey),
          "desc"
        )
        .first(),
    ]).pipe(Effect.mapError(toTryoutRuntimeError));
    return {
      activeAttempt: Option.getOrNull(activeAttempt),
      nextAttemptNumber: (Option.getOrNull(numbered)?.attemptNumber ?? 0) + 1,
    };
  }
);

/**
 * Reads the latest attempt through the compact current-set progress row.
 * @see https://docs.convex.dev/database/reading-data/indexes/
 */
export const readLatestProgressAttempt = Effect.fn(
  "tryouts.runtime.readLatestProgressAttempt"
)(function* (identity: TryoutSetIdentity, userId: UserId) {
  const database = yield* DatabaseReader;
  const progress = yield* database
    .table("tryoutSetProgress")
    .get(
      "by_userId_and_set",
      userId,
      identity.countryKey,
      identity.examKey,
      identity.trackKey,
      identity.setKey
    )
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.mapError(toTryoutRuntimeError)
    );
  if (!progress) {
    return null;
  }
  const attempt = yield* database
    .table("tryoutAttempts")
    .get(progress.latestAttemptId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.mapError(toTryoutRuntimeError)
    );
  if (!attempt) {
    return yield* TryoutRuntimeError.make({
      code: "TRYOUT_PROGRESS_ATTEMPT_MISMATCH",
      message: "Try-out progress no longer identifies its latest attempt.",
    });
  }
  const matches = matchesProgressAttempt(attempt, progress, identity, userId);
  if (!matches) {
    return yield* TryoutRuntimeError.make({
      code: "TRYOUT_PROGRESS_ATTEMPT_MISMATCH",
      message: "Try-out progress no longer identifies its latest attempt.",
    });
  }
  return attempt;
});

/** Reads one exact attempt only when it belongs to the current app user. */
export const readOwnedAttemptById = Effect.fn(
  "tryouts.runtime.readOwnedAttemptById"
)(function* (attemptId: Id<"tryoutAttempts">, userId: UserId) {
  const database = yield* DatabaseReader;
  const attempt = yield* database
    .table("tryoutAttempts")
    .get(attemptId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.mapError(toTryoutRuntimeError)
    );
  if (attempt?.userId !== userId) {
    return null;
  }
  return attempt;
});

/** Reads the complete identity persisted on every signed attempt. */
export function readAttemptSetIdentity(attempt: TryoutAttempt) {
  return {
    countryKey: attempt.countryKey,
    examKey: attempt.examKey,
    locale: attempt.appLocale,
    setKey: attempt.setKey,
    trackKey: attempt.trackKey,
  };
}

/** Checks that route keys select one resolved logical set identity. */
export function matchesAttemptIdentity(
  attemptIdentity: TryoutSetIdentity,
  routeIdentity: TryoutSetIdentity
) {
  return (
    attemptIdentity.countryKey === routeIdentity.countryKey &&
    attemptIdentity.examKey === routeIdentity.examKey &&
    attemptIdentity.setKey === routeIdentity.setKey &&
    attemptIdentity.trackKey === routeIdentity.trackKey
  );
}

/** Checks that compact progress and its latest attempt describe one state. */
function matchesProgressAttempt(
  attempt: TryoutAttempt,
  progress: Docs["tryoutSetProgress"],
  identity: TryoutSetIdentity,
  userId: UserId
) {
  const attemptIdentity = readAttemptSetIdentity(attempt);
  if (!matchesAttemptIdentity(attemptIdentity, identity)) {
    return false;
  }
  if (
    attempt.userId !== userId ||
    attempt.appLocale !== progress.appLocale ||
    attempt.setIdentity !== progress.setIdentity
  ) {
    return false;
  }
  if (attempt.attemptNumber !== progress.attemptNumber) {
    return false;
  }
  if (attempt.status !== progress.status) {
    return false;
  }
  return progress.statusRank === getTryoutStatusRank(progress.status);
}

/** Reads one bounded attempt history page through immutable set keys. */
export const readAttemptHistoryPageBySet = Effect.fn(
  "tryouts.runtime.readAttemptHistoryPageBySet"
)(function* (
  identity: TryoutSetIdentity,
  userId: UserId,
  pagination: PaginationOptions
) {
  const database = yield* DatabaseReader;
  return yield* database
    .table("tryoutAttempts")
    .index(
      "by_userId_and_set_and_startedAt",
      (index) =>
        index
          .eq("userId", userId)
          .eq("countryKey", identity.countryKey)
          .eq("examKey", identity.examKey)
          .eq("trackKey", identity.trackKey)
          .eq("setKey", identity.setKey),
      "desc"
    )
    .paginate(pagination)
    .pipe(Effect.mapError(toTryoutRuntimeError));
});
