import { DatabaseReader, DatabaseWriter, Scheduler } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  toUserCleanupError,
  type UserCleanupError,
} from "@repo/backend/confect/auth/cleanup/spec";
import {
  ACCOUNT_DELETION_RECONCILIATION_DELAY_MS,
  ACCOUNT_DELETION_RECOVERY_SWEEP_BATCH_SIZE,
} from "@repo/backend/confect/auth/deletion/constants";
import type { sweepAccountDeletionRecoveryArgsValidator } from "@repo/backend/confect/auth/deletion/recovery.spec";
import type { AccountDeletionPreparationVersion } from "@repo/backend/confect/auth/deletion/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Clock, Duration, Effect, flow, type Schema } from "effect";
export type SweepAccountDeletionRecoveryArgs = Schema.Schema.Type<
  typeof sweepAccountDeletionRecoveryArgsValidator
>;
export interface RecoveryOperations {
  readonly authUserExists: Effect.Effect<boolean, UserCleanupError>;
  readonly cancel: Effect.Effect<unknown, UserCleanupError>;
  readonly continueCommit: Effect.Effect<boolean, UserCleanupError>;
  readonly finalize: Effect.Effect<unknown, UserCleanupError>;
}
/** Restores an aborted deletion or finishes one whose auth user is gone. */
export const recoverAccountDeletionProgram: (
  operations: RecoveryOperations
) => Effect.Effect<void, UserCleanupError> = Effect.fn(
  "auth.deletion.recoverAccountDeletion"
)(function* (operations: RecoveryOperations) {
  const commitStarted = yield* operations.continueCommit;
  if (commitStarted) {
    return;
  }
  const authUserExists = yield* operations.authUserExists;
  if (authUserExists) {
    yield* operations.cancel;
    return;
  }
  yield* operations.finalize;
});
export type ScheduleRecovery = (
  ctx: MutationCtx,
  authId: string,
  expectedPreparation: AccountDeletionPreparationVersion
) => Effect.Effect<unknown, UserCleanupError>;
const defaultScheduleRecovery: ScheduleRecovery = Effect.fn(
  "auth.deletion.scheduleRecovery"
)(
  function* (ctx, authId, expectedPreparation) {
    const scheduler = yield* Scheduler.Scheduler.pipe(
      Effect.provide(Scheduler.layer(ctx.scheduler))
    );
    yield* scheduler.runAfter(
      Duration.zero,
      refs.internal.auth.deletion.recovery.recoverAccountDeletion,
      { authId, expectedPreparation }
    );
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
/**
 * Claims due recovery leases before scheduling at-most-once auth reads.
 *
 * Advancing the indexed due time and scheduling the action share one mutation
 * transaction. A missed or failed action therefore becomes due again without
 * depending on that action to reschedule itself.
 */
export const sweepAccountDeletionRecoveryProgram: (
  ctx: MutationCtx,
  scheduleRecovery?: ScheduleRecovery
) => Effect.Effect<boolean, UserCleanupError> = Effect.fn(
  "auth.deletion.sweepAccountDeletionRecovery"
)(
  function* (
    ctx: MutationCtx,
    scheduleRecovery: ScheduleRecovery = defaultScheduleRecovery
  ) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const now = yield* Clock.currentTimeMillis;
    const preparations = yield* database
      .table("accountDeletionPreparations")
      .index("by_recoveryAt", (query) =>
        query.gt("recoveryAt", undefined).lte("recoveryAt", now)
      )
      .take(ACCOUNT_DELETION_RECOVERY_SWEEP_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const preparation of preparations) {
      if (
        preparation.attemptId === undefined ||
        preparation.finalizedAt !== undefined
      ) {
        yield* Effect.logError(
          "Account deletion preparation has an invalid recovery lease"
        ).pipe(
          Effect.annotateLogs({
            preparationId: preparation._id,
          }),
          Effect.andThen(
            writer
              .table("accountDeletionPreparations")
              .patch(preparation._id, {
                recoveryAt: undefined,
              })
              .pipe(Effect.orDie)
          )
        );
        continue;
      }
      const recoveryGeneration = preparation.recoveryGeneration + 1;
      const expectedPreparation = {
        attemptId: preparation.attemptId,
        preparationId: preparation._id,
        recoveryGeneration,
      };
      yield* writer
        .table("accountDeletionPreparations")
        .patch(preparation._id, {
          recoveryAt: now + ACCOUNT_DELETION_RECONCILIATION_DELAY_MS,
          recoveryGeneration,
        })
        .pipe(Effect.orDie);
      yield* scheduleRecovery(ctx, preparation.authId, expectedPreparation);
    }
    return preparations.length === ACCOUNT_DELETION_RECOVERY_SWEEP_BATCH_SIZE;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
