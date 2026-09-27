import { DatabaseReader, DatabaseWriter, Scheduler } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  toUserCleanupError,
  type UserCleanupError,
} from "@repo/backend/confect/auth/cleanup/spec";
import { ACCOUNT_DELETION_RECONCILIATION_DELAY_MS } from "@repo/backend/confect/auth/deletion/constants";
import { recordAccountDeletionReceipt } from "@repo/backend/confect/auth/deletion/receipt";
import type { AccountDeletionPreparationVersion } from "@repo/backend/confect/auth/deletion/spec";
import { createDeletedUserTombstone } from "@repo/backend/confect/auth/deletion/tombstone";
import { finalizeSchoolTransfers } from "@repo/backend/confect/auth/deletion/transfers";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Clock, Duration, Effect, flow } from "effect";

type ScheduleCleanup = (
  ctx: MutationCtx,
  identity: {
    readonly authId: string;
    readonly userId: Id<"users">;
  }
) => Effect.Effect<unknown, UserCleanupError>;
type ScheduleContinuation = (
  ctx: MutationCtx,
  authId: string,
  expectedPreparation?: AccountDeletionPreparationVersion
) => Effect.Effect<unknown, UserCleanupError>;

/**
 * Applies reserved school transfers only after Better Auth confirms that its
 * user row is gone, then journals durable personal-data cleanup.
 */
export const finalizeAccountDeletion: (
  ctx: MutationCtx,
  authId: string,
  expectedPreparation?: AccountDeletionPreparationVersion,
  scheduleCleanup?: ScheduleCleanup,
  scheduleContinuation?: ScheduleContinuation
) => Effect.Effect<void, UserCleanupError> = Effect.fn(
  "auth.deletion.finalizeAccountDeletion"
)(
  function* (
    ctx: MutationCtx,
    authId: string,
    expectedPreparation?: AccountDeletionPreparationVersion,
    scheduleCleanup: ScheduleCleanup = Effect.fn(
      "auth.deletion.scheduleCleanup"
    )(
      function* (cleanupCtx, identity) {
        const scheduler = yield* Scheduler.Scheduler.pipe(
          Effect.provide(Scheduler.layer(cleanupCtx.scheduler))
        );
        yield* scheduler.runAfter(
          Duration.zero,
          refs.internal.customers.deletion.workflow.launchDeletedUserCleanup,
          identity
        );
        yield* scheduler.runAfter(
          Duration.millis(ACCOUNT_DELETION_RECONCILIATION_DELAY_MS),
          refs.internal.customers.deletion.workflow.finalizeDeletedUserCleanup,
          { authId: identity.authId }
        );
      },
      Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
    ),
    scheduleContinuation: ScheduleContinuation = Effect.fn(
      "auth.deletion.scheduleFinalization"
    )(
      function* (continuationCtx, continuationAuthId, continuationPreparation) {
        const scheduler = yield* Scheduler.Scheduler.pipe(
          Effect.provide(Scheduler.layer(continuationCtx.scheduler))
        );
        yield* scheduler.runAfter(
          Duration.zero,
          refs.internal.customers.deletion.workflow.finalizeDeletedUserCleanup,
          {
            authId: continuationAuthId,
            ...(continuationPreparation === undefined
              ? {}
              : { expectedPreparation: continuationPreparation }),
          }
        );
      },
      Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
    )
  ) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
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
        ctx,
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
        ctx,
        user,
        preparation._id,
        finalizedAt
      );
      if (needsContinuation) {
        yield* scheduleContinuation(ctx, authId, expectedPreparation);
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
      ctx,
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
    yield* scheduleCleanup(ctx, { authId, userId: user._id });
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
