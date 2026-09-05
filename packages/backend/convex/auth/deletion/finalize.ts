import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  tryUserCleanup,
  type UserCleanupError,
} from "@repo/backend/convex/auth/cleanup/spec";
import { ACCOUNT_DELETION_RECONCILIATION_DELAY_MS } from "@repo/backend/convex/auth/deletion/constants";
import { recordAccountDeletionReceipt } from "@repo/backend/convex/auth/deletion/receipt";
import type { AccountDeletionPreparationVersion } from "@repo/backend/convex/auth/deletion/spec";
import { createDeletedUserTombstone } from "@repo/backend/convex/auth/deletion/tombstone";
import { finalizeSchoolTransfers } from "@repo/backend/convex/auth/deletion/transfers";
import { makeFunctionReference } from "convex/server";
import { Clock, Effect } from "effect";

const launchDeletedUserCleanupReference = makeFunctionReference<
  "mutation",
  { authId: string; userId: Id<"users"> },
  null
>("customers/deletion/workflow:launchDeletedUserCleanup");
const retryAccountDeletionFinalizationReference = makeFunctionReference<
  "mutation",
  {
    authId: string;
    expectedPreparation?: AccountDeletionPreparationVersion;
  },
  null
>("customers/deletion/workflow:finalizeDeletedUserCleanup");

type ScheduleCleanup = (
  ctx: MutationCtx,
  identity: {
    readonly authId: string;
    readonly userId: Id<"users">;
  }
) => Promise<unknown>;

type ScheduleContinuation = (
  ctx: MutationCtx,
  authId: string,
  expectedPreparation?: AccountDeletionPreparationVersion
) => Promise<unknown>;

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
)(function* (
  ctx: MutationCtx,
  authId: string,
  expectedPreparation?: AccountDeletionPreparationVersion,
  scheduleCleanup: ScheduleCleanup = async (cleanupCtx, identity) => {
    await cleanupCtx.scheduler.runAfter(0, launchDeletedUserCleanupReference, {
      authId: identity.authId,
      userId: identity.userId,
    });
    await cleanupCtx.scheduler.runAfter(
      ACCOUNT_DELETION_RECONCILIATION_DELAY_MS,
      retryAccountDeletionFinalizationReference,
      { authId: identity.authId }
    );
  },
  scheduleContinuation: ScheduleContinuation = (
    continuationCtx,
    continuationAuthId,
    continuationPreparation
  ) =>
    continuationCtx.scheduler.runAfter(
      0,
      retryAccountDeletionFinalizationReference,
      {
        authId: continuationAuthId,
        expectedPreparation: continuationPreparation,
      }
    )
) {
  const preparation = yield* tryUserCleanup(() =>
    ctx.db
      .query("accountDeletionPreparations")
      .withIndex("by_authId", (query) => query.eq("authId", authId))
      .unique()
  );

  if (
    expectedPreparation !== undefined &&
    (preparation?.attemptId !== expectedPreparation.attemptId ||
      preparation._id !== expectedPreparation.preparationId ||
      preparation.recoveryGeneration !== expectedPreparation.recoveryGeneration)
  ) {
    return;
  }

  const userByAuthId = yield* tryUserCleanup(() =>
    ctx.db
      .query("users")
      .withIndex("by_authId", (query) => query.eq("authId", authId))
      .unique()
  );
  const user =
    userByAuthId ??
    (preparation
      ? yield* tryUserCleanup(() => ctx.db.get("users", preparation.userId))
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
      yield* tryUserCleanup(() =>
        scheduleContinuation(ctx, authId, expectedPreparation)
      );
      return;
    }

    yield* tryUserCleanup(() =>
      ctx.db.patch("accountDeletionPreparations", preparation._id, {
        finalizedAt,
        recoveryAt: undefined,
      })
    );
  } else if (!preparation) {
    yield* tryUserCleanup(() =>
      ctx.db.insert("accountDeletionPreparations", {
        authId,
        finalizedAt,
        recoveryGeneration: 0,
        userId: user._id,
      })
    );
  }

  yield* recordAccountDeletionReceipt(
    ctx,
    preparation?.attemptId,
    preparation?.finalizedAt ?? finalizedAt
  );
  yield* tryUserCleanup(() =>
    ctx.db.patch(
      "users",
      user._id,
      createDeletedUserTombstone(user._id, user.deletedAt ?? finalizedAt)
    )
  );
  yield* tryUserCleanup(() =>
    scheduleCleanup(ctx, {
      authId,
      userId: user._id,
    })
  );
});
