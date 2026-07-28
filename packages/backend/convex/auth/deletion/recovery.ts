import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  internalAction,
  internalMutation,
} from "@repo/backend/convex/_generated/server";
import {
  tryUserCleanup,
  type UserCleanupError,
} from "@repo/backend/convex/auth/cleanup/spec";
import {
  ACCOUNT_DELETION_RECOVERY_RETRY_DELAY_MS,
  ACCOUNT_DELETION_RECOVERY_SWEEP_BATCH_SIZE,
} from "@repo/backend/convex/auth/deletion/constants";
import {
  type AccountDeletionPreparationVersion,
  accountDeletionPreparationVersionValidator,
} from "@repo/backend/convex/auth/deletion/spec";
import { authReader } from "@repo/backend/convex/auth/reader";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import { type Infer, v } from "convex/values";
import { Clock, Effect } from "effect";

const sweepAccountDeletionRecoveryArgsValidator = v.object({});
type SweepAccountDeletionRecoveryArgs = Infer<
  typeof sweepAccountDeletionRecoveryArgsValidator
>;
const cancelAccountDeletionReference = makeFunctionReference<
  "mutation",
  {
    authId: string;
    expectedPreparation?: AccountDeletionPreparationVersion;
  },
  boolean
>("auth/deletion:cancelAccountDeletion");
const finalizeDeletedUserCleanupReference = makeFunctionReference<
  "mutation",
  {
    authId: string;
    expectedPreparation?: AccountDeletionPreparationVersion;
  },
  null
>("customers/deletion/workflow:finalizeDeletedUserCleanup");
const recoverAccountDeletionReference = makeFunctionReference<
  "action",
  {
    authId: string;
    expectedPreparation: AccountDeletionPreparationVersion;
  },
  null
>("auth/deletion/recovery:recoverAccountDeletion");
const sweepAccountDeletionRecoveryReference = makeFunctionReference<
  "mutation",
  SweepAccountDeletionRecoveryArgs,
  null
>("auth/deletion/recovery:sweepAccountDeletionRecovery");

interface RecoveryOperations {
  readonly authUserExists: () => Promise<boolean>;
  readonly cancel: () => Promise<boolean>;
  readonly finalize: () => Promise<unknown>;
}

/** Restores an aborted deletion or finishes one whose auth user is gone. */
export const recoverAccountDeletionProgram: (
  operations: RecoveryOperations
) => Effect.Effect<void, UserCleanupError> = Effect.fn(
  "auth.deletion.recoverAccountDeletion"
)(function* (operations: RecoveryOperations) {
  const authUserExists = yield* tryUserCleanup(operations.authUserExists);

  if (authUserExists) {
    let hasMore = yield* tryUserCleanup(operations.cancel);

    while (hasMore) {
      hasMore = yield* tryUserCleanup(operations.cancel);
    }
    return;
  }

  yield* tryUserCleanup(operations.finalize);
});

type ScheduleRecovery = (
  ctx: MutationCtx,
  authId: string,
  expectedPreparation: AccountDeletionPreparationVersion
) => Promise<unknown>;

const defaultScheduleRecovery: ScheduleRecovery = (
  ctx,
  authId,
  expectedPreparation
) =>
  ctx.scheduler.runAfter(0, recoverAccountDeletionReference, {
    authId,
    expectedPreparation,
  });

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
)(function* (
  ctx: MutationCtx,
  scheduleRecovery: ScheduleRecovery = defaultScheduleRecovery
) {
  const now = yield* Clock.currentTimeMillis;
  const preparations = yield* tryUserCleanup(() =>
    ctx.db
      .query("accountDeletionPreparations")
      .withIndex("by_recoveryAt", (query) =>
        query.gt("recoveryAt", undefined).lte("recoveryAt", now)
      )
      .take(ACCOUNT_DELETION_RECOVERY_SWEEP_BATCH_SIZE)
  );

  for (const preparation of preparations) {
    if (
      preparation.attemptId === undefined ||
      preparation.finalizedAt !== undefined
    ) {
      yield* Effect.logError(
        "Account deletion preparation has an invalid recovery lease"
      ).pipe(
        Effect.annotateLogs({ preparationId: preparation._id }),
        Effect.zipRight(
          tryUserCleanup(() =>
            ctx.db.patch("accountDeletionPreparations", preparation._id, {
              recoveryAt: undefined,
            })
          )
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

    yield* tryUserCleanup(() =>
      ctx.db.patch("accountDeletionPreparations", preparation._id, {
        recoveryAt: now + ACCOUNT_DELETION_RECOVERY_RETRY_DELAY_MS,
        recoveryGeneration,
      })
    );
    yield* tryUserCleanup(() =>
      scheduleRecovery(ctx, preparation.authId, expectedPreparation)
    );
  }

  return preparations.length === ACCOUNT_DELETION_RECOVERY_SWEEP_BATCH_SIZE;
});

/** Claims due recovery leases and drains additional bounded pages. */
export const sweepAccountDeletionRecovery = internalMutation({
  args: sweepAccountDeletionRecoveryArgsValidator,
  returns: v.null(),
  handler: (ctx) =>
    runConvexProgram(
      Effect.gen(function* () {
        const hasMore = yield* sweepAccountDeletionRecoveryProgram(ctx);

        if (hasMore) {
          yield* tryUserCleanup(() =>
            ctx.scheduler.runAfter(0, sweepAccountDeletionRecoveryReference, {})
          );
        }
      }).pipe(Effect.as(null))
    ),
});

/** Reconciles one prepared deletion after the Better Auth request has settled. */
export const recoverAccountDeletion = internalAction({
  args: {
    authId: v.string(),
    expectedPreparation: accountDeletionPreparationVersionValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runConvexProgram(
      recoverAccountDeletionProgram({
        authUserExists: async () =>
          (await authReader.getAnyUserById(ctx, args.authId)) !== null,
        cancel: () =>
          ctx.runMutation(cancelAccountDeletionReference, {
            authId: args.authId,
            expectedPreparation: args.expectedPreparation,
          }),
        finalize: () =>
          ctx.runMutation(finalizeDeletedUserCleanupReference, {
            authId: args.authId,
            expectedPreparation: args.expectedPreparation,
          }),
      }).pipe(Effect.annotateLogs({ authId: args.authId }))
    );

    return null;
  },
});
