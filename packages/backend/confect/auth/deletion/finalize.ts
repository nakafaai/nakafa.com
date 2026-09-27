import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import { ACCOUNT_DELETION_RECONCILIATION_DELAY_MS } from "@repo/backend/confect/auth/deletion/constants";
import { recordAccountDeletionReceipt } from "@repo/backend/confect/auth/deletion/receipt";
import type { AccountDeletionPreparationVersion } from "@repo/backend/confect/auth/deletion/spec";
import { createDeletedUserTombstone } from "@repo/backend/confect/auth/deletion/tombstone";
import { finalizeSchoolTransfers } from "@repo/backend/confect/auth/deletion/transfers";
import { Clock, Duration, Effect, flow } from "effect";
/**
 * Applies reserved school transfers only after Better Auth confirms that its
 * user row is gone, then journals durable personal-data cleanup.
 */
export const finalizeAccountDeletion = Effect.fn(
  "auth.deletion.finalizeAccountDeletion"
)(
  function* (
    authId: string,
    expectedPreparation?: AccountDeletionPreparationVersion
  ) {
    const scheduler = yield* Scheduler;
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const preparation = yield* database
      .table("accountDeletionPreparations")
      .get("by_authId", authId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (
      expectedPreparation !== undefined &&
      (preparation?.attemptId !== expectedPreparation.attemptId ||
        preparation._id !== expectedPreparation.preparationId ||
        preparation.recoveryGeneration !==
          expectedPreparation.recoveryGeneration)
    ) {
      return;
    }
    const userByAuthId = yield* database
      .table("users")
      .get("by_authId", authId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    const user =
      userByAuthId ??
      (preparation
        ? yield* database
            .table("users")
            .get(preparation.userId)
            .pipe(Effect.orDie)
        : null);
    if (!user) {
      return;
    }
    if (
      user.deletionCleanupStartedAt !== undefined &&
      preparation?.finalizedAt !== undefined
    ) {
      yield* recordAccountDeletionReceipt(
        preparation.attemptId,
        preparation.finalizedAt
      );
      return;
    }
    if (user.deletionCleanupStartedAt !== undefined) {
      return;
    }
    const finalizedAt = yield* Clock.currentTimeMillis;
    if (preparation && preparation.finalizedAt === undefined) {
      const needsContinuation = yield* finalizeSchoolTransfers(
        user,
        preparation._id,
        finalizedAt
      );
      if (needsContinuation) {
        yield* scheduler.runAfter(
          Duration.zero,
          refs.internal.customers.deletion.workflow.finalizeDeletedUserCleanup,
          {
            authId,
            ...(expectedPreparation === undefined
              ? {}
              : { expectedPreparation }),
          }
        );
        return;
      }
      yield* writer
        .table("accountDeletionPreparations")
        .patch(preparation._id, {
          finalizedAt,
          recoveryAt: undefined,
        })
        .pipe(Effect.orDie);
    } else if (!preparation) {
      yield* writer
        .table("accountDeletionPreparations")
        .insert({
          authId,
          finalizedAt,
          recoveryGeneration: 0,
          userId: user._id,
        })
        .pipe(Effect.orDie);
    }
    yield* recordAccountDeletionReceipt(
      preparation?.attemptId,
      preparation?.finalizedAt ?? finalizedAt
    );
    yield* writer
      .table("users")
      .patch(
        user._id,
        createDeletedUserTombstone(user._id, user.deletedAt ?? finalizedAt)
      )
      .pipe(Effect.orDie);
    yield* scheduler.runAfter(
      Duration.zero,
      refs.internal.customers.deletion.workflow.launchDeletedUserCleanup,
      { authId, userId: user._id }
    );
    yield* scheduler.runAfter(
      Duration.millis(ACCOUNT_DELETION_RECONCILIATION_DELAY_MS),
      refs.internal.customers.deletion.workflow.finalizeDeletedUserCleanup,
      { authId }
    );
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
