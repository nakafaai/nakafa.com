import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  toUserCleanupError,
  type UserCleanupError,
} from "@repo/backend/confect/auth/cleanup/spec";
import {
  cancelPreparedAccountDeletion,
  hasAccountDeletionCancellation,
} from "@repo/backend/confect/auth/deletion/cancel";
import { accountDeletionCancellationOutcome } from "@repo/backend/confect/auth/deletion/spec";
import { Effect, flow } from "effect";

/** Cancels only the browser attempt that created the active preparation. */
export const cancelAccountDeletionAttempt = Effect.fn(
  "auth.deletion.attemptCancellation.cancel"
)(
  function* (authId: string, attemptId: string) {
    const database = yield* DatabaseReader;
    const preparation = yield* database
      .table("accountDeletionPreparations")
      .get("by_authId", authId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (
      !preparation ||
      preparation.deletionStartedAt !== undefined ||
      preparation.finalizedAt !== undefined ||
      preparation.attemptId !== attemptId
    ) {
      return false;
    }
    return yield* cancelPreparedAccountDeletion({
      ...preparation,
      attemptId,
    });
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/**
 * Cancels a browser-owned attempt only while the Better Auth user still
 * exists. The unguessable attempt ID is the narrow recovery capability.
 */
export const cancelAccountDeletionAttemptByToken = Effect.fn(
  "auth.deletion.attemptCancellation.cancelByToken"
)(
  function* (
    attemptId: string,
    authUserExists: (authId: string) => Effect.Effect<boolean, UserCleanupError>
  ) {
    const database = yield* DatabaseReader;
    const preparation = yield* database
      .table("accountDeletionPreparations")
      .get("by_attemptId", attemptId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!preparation) {
      return (yield* hasAccountDeletionCancellation(attemptId))
        ? accountDeletionCancellationOutcome.complete
        : null;
    }
    if (
      preparation.deletionStartedAt !== undefined ||
      preparation.finalizedAt !== undefined
    ) {
      return null;
    }
    const userStillExists = yield* authUserExists(preparation.authId);
    if (!userStillExists) {
      return null;
    }
    const hasMore = yield* cancelAccountDeletionAttempt(
      preparation.authId,
      attemptId
    );
    return hasMore
      ? accountDeletionCancellationOutcome.continue
      : accountDeletionCancellationOutcome.complete;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
