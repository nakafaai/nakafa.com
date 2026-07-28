import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  tryUserCleanup,
  type UserCleanupError,
} from "@repo/backend/convex/auth/cleanup/spec";
import {
  ACCOUNT_DELETION_RECOVERY_RETRY_DELAY_MS,
  ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE,
} from "@repo/backend/convex/auth/deletion/constants";
import { recordAccountDeletionReceipt } from "@repo/backend/convex/auth/deletion/receipt";
import type { AccountDeletionPreparationVersion } from "@repo/backend/convex/auth/deletion/spec";
import { isAccountDeletionPending } from "@repo/backend/convex/auth/deletion/state";
import { findSchoolOwnershipSuccessorPage } from "@repo/backend/convex/auth/deletion/successor";
import { createDeletedUserTombstone } from "@repo/backend/convex/auth/deletion/tombstone";
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

/** Applies or advances one reserved school transfer. */
const finalizeSchoolTransfer = Effect.fn(
  "auth.deletion.finalizeSchoolTransfer"
)(function* (
  ctx: MutationCtx,
  user: Doc<"users">,
  transfer: Doc<"accountDeletionSchoolTransfers">,
  finalizedAt: number
) {
  const school = yield* tryUserCleanup(() =>
    ctx.db.get("schools", transfer.schoolId)
  );

  if (!school || school.createdBy !== user._id) {
    yield* tryUserCleanup(() =>
      ctx.db.delete("accountDeletionSchoolTransfers", transfer._id)
    );
    return {
      needsContinuation: false,
      usedPagination: false,
    };
  }

  const reservedMembership = yield* tryUserCleanup(() =>
    ctx.db.get("schoolMembers", transfer.successorMembershipId)
  );
  const reservedUser = yield* tryUserCleanup(() =>
    ctx.db.get("users", transfer.successorUserId)
  );
  const hasValidReservation =
    reservedMembership?.schoolId === school._id &&
    reservedMembership.status === "active" &&
    reservedMembership.userId === transfer.successorUserId &&
    reservedUser !== null &&
    !isAccountDeletionPending(reservedUser);
  let successorMembership = hasValidReservation
    ? reservedMembership
    : undefined;

  if (!successorMembership) {
    const successor = yield* findSchoolOwnershipSuccessorPage(
      ctx,
      school._id,
      user._id,
      transfer.successorCursor ?? null
    );

    if (successor.kind === "continue") {
      yield* tryUserCleanup(() =>
        ctx.db.patch("accountDeletionSchoolTransfers", transfer._id, {
          successorCursor: successor.cursor,
        })
      );
      return {
        needsContinuation: true,
        usedPagination: true,
      };
    }

    if (successor.kind === "found") {
      successorMembership = successor.successorMembership;
    }
  }

  if (successorMembership && successorMembership.role !== "admin") {
    yield* tryUserCleanup(() =>
      ctx.db.patch("schoolMembers", successorMembership._id, {
        role: "admin",
        updatedAt: finalizedAt,
      })
    );
  }

  if (successorMembership) {
    yield* tryUserCleanup(() =>
      ctx.db.patch("schools", school._id, {
        createdBy: successorMembership.userId,
        updatedAt: finalizedAt,
        updatedBy: successorMembership.userId,
      })
    );
  }

  /*
   * Normal writers cannot invalidate a reservation: successor deletion is
   * blocked and memberships have no removal mutation. If manually corrupted
   * data has no fallback successor, retain the shared school on the anonymous
   * owner tombstone instead of deleting institutional data.
   */
  yield* tryUserCleanup(() =>
    ctx.db.delete("accountDeletionSchoolTransfers", transfer._id)
  );
  return {
    needsContinuation: !hasValidReservation,
    usedPagination: !hasValidReservation,
  };
});

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
      ACCOUNT_DELETION_RECOVERY_RETRY_DELAY_MS,
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
    const transfers = yield* tryUserCleanup(() =>
      ctx.db
        .query("accountDeletionSchoolTransfers")
        .withIndex("by_preparationId", (query) =>
          query.eq("preparationId", preparation._id)
        )
        .take(ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE + 1)
    );
    let needsContinuation =
      transfers.length > ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE;

    for (const transfer of transfers.slice(
      0,
      ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE
    )) {
      const finalization = yield* finalizeSchoolTransfer(
        ctx,
        user,
        transfer,
        finalizedAt
      );
      needsContinuation = finalization.needsContinuation || needsContinuation;

      if (finalization.usedPagination) {
        break;
      }
    }

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
