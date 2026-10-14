import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import { hasAccountDeletionCancellation } from "@repo/backend/confect/auth/deletion/cancel";
import { ACCOUNT_DELETION_RECOVERY_DELAY_MS } from "@repo/backend/confect/auth/deletion/constants";
import { accountDeletionPreparationOutcome } from "@repo/backend/confect/auth/deletion/spec";
import { Clock, Effect, flow } from "effect";

type AccountDeletionPreparation = Docs["accountDeletionPreparations"];
type AppUser = Docs["users"];

/** Marks a preparation ready and refreshes its recovery lease. */
const completePreparation = Effect.fn("auth.deletion.completePreparation")(
  function* (user: AppUser, preparation: AccountDeletionPreparation) {
    const writer = yield* DatabaseWriter;
    const readyAt = yield* Clock.currentTimeMillis;
    yield* writer
      .table("accountDeletionPreparations")
      .patch(preparation._id, {
        readyAt,
        recoveryAt: readyAt + ACCOUNT_DELETION_RECOVERY_DELAY_MS,
        recoveryGeneration: preparation.recoveryGeneration + 1,
      })
      .pipe(Effect.orDie);
    yield* writer
      .table("users")
      .patch(user._id, {
        deletionPreparedAt: readyAt,
      })
      .pipe(Effect.orDie);
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/**
 * Creates or refreshes the exact browser attempt's durable preparation in one
 * transaction and quiesces the account's writes.
 */
export const prepareAccountDeletion = Effect.fn(
  "auth.deletion.prepareAccountDeletion"
)(
  function* (authId: string, attemptId: string) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const user = yield* database
      .table("users")
      .get("by_authId", authId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!user || user.deletedAt !== undefined) {
      return accountDeletionPreparationOutcome.ready;
    }
    if (yield* hasAccountDeletionCancellation(attemptId)) {
      return accountDeletionPreparationOutcome.temporarilyUnavailable;
    }
    let preparation = yield* database
      .table("accountDeletionPreparations")
      .get("by_authId", authId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (preparation?.finalizedAt !== undefined) {
      return accountDeletionPreparationOutcome.temporarilyUnavailable;
    }
    if (
      preparation &&
      (preparation.attemptId !== attemptId || preparation.userId !== user._id)
    ) {
      return accountDeletionPreparationOutcome.temporarilyUnavailable;
    }
    if (!preparation) {
      const preparationStartedAt = yield* Clock.currentTimeMillis;
      const preparationId = yield* writer
        .table("accountDeletionPreparations")
        .insert({
          attemptId,
          authId,
          recoveryAt: preparationStartedAt + ACCOUNT_DELETION_RECOVERY_DELAY_MS,
          recoveryGeneration: 0,
          userId: user._id,
        })
        .pipe(Effect.orDie);
      preparation = yield* database
        .table("accountDeletionPreparations")
        .get(preparationId)
        .pipe(Effect.orDie);
    }
    yield* completePreparation(user, preparation);
    return accountDeletionPreparationOutcome.ready;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
