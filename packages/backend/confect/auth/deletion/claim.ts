import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import { ACCOUNT_DELETION_RECOVERY_DELAY_MS } from "@repo/backend/confect/auth/deletion/constants";
import { prepareAccountDeletion } from "@repo/backend/confect/auth/deletion/prepare";
import { accountDeletionPreparationOutcome } from "@repo/backend/confect/auth/deletion/spec";
import { removeWelcomeIntent } from "@repo/backend/confect/emails/welcome/impl";
import { Clock, Effect, flow } from "effect";

/**
 * Claims the irreversible deletion phase only from Better Auth's before-delete
 * hook. Browser preparation remains cancelable until this mutation commits.
 */
export const claimAccountDeletion = Effect.fn(
  "auth.deletion.claimAccountDeletion"
)(
  function* (authId: string, attemptId: string) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const outcome = yield* prepareAccountDeletion(authId, attemptId);
    if (outcome !== accountDeletionPreparationOutcome.ready) {
      return outcome;
    }
    const [preparation, user] = yield* Effect.all([
      database
        .table("accountDeletionPreparations")
        .get("by_authId", authId)
        .pipe(
          Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
          Effect.orDie
        ),
      database
        .table("users")
        .get("by_authId", authId)
        .pipe(
          Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
          Effect.orDie
        ),
    ]);
    if (!user || user.deletedAt !== undefined) {
      return accountDeletionPreparationOutcome.ready;
    }

    /*
     * For an active user, prepareAccountDeletion returns ready only after the
     * matching preparation and user marker are durable in this transaction.
     * Missing state here is therefore a violated internal invariant, not a
     * recoverable preparation outcome.
     */
    const claimedPreparation = yield* Effect.fromNullishOr(preparation).pipe(
      Effect.orDie
    );
    yield* removeWelcomeIntent(user._id);
    const deletionStartedAt = yield* Clock.currentTimeMillis;
    yield* writer
      .table("accountDeletionPreparations")
      .patch(claimedPreparation._id, {
        deletionStartedAt:
          claimedPreparation.deletionStartedAt ?? deletionStartedAt,
        recoveryAt: deletionStartedAt + ACCOUNT_DELETION_RECOVERY_DELAY_MS,
        recoveryGeneration: claimedPreparation.recoveryGeneration + 1,
      })
      .pipe(Effect.orDie);
    return accountDeletionPreparationOutcome.ready;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
