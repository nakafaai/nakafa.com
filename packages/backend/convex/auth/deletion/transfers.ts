import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { tryUserCleanup } from "@repo/backend/convex/auth/cleanup/spec";
import { ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE } from "@repo/backend/convex/auth/deletion/constants";
import { isAccountDeletionPending } from "@repo/backend/convex/auth/deletion/state";
import { findSchoolOwnershipSuccessorPage } from "@repo/backend/convex/auth/deletion/successor";
import { Effect } from "effect";

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

/** Finalizes a bounded transfer batch, stopping after one successor pagination. */
export const finalizeSchoolTransfers = Effect.fn(
  "auth.deletion.finalizeSchoolTransfers"
)(function* (
  ctx: MutationCtx,
  user: Doc<"users">,
  preparationId: Id<"accountDeletionPreparations">,
  finalizedAt: number
) {
  const transfers = yield* tryUserCleanup(() =>
    ctx.db
      .query("accountDeletionSchoolTransfers")
      .withIndex("by_preparationId", (query) =>
        query.eq("preparationId", preparationId)
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
  return needsContinuation;
});
