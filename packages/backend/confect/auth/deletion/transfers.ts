import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import { ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE } from "@repo/backend/confect/auth/deletion/constants";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import { findSchoolOwnershipSuccessorPage } from "@repo/backend/confect/auth/deletion/successor";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Effect, flow } from "effect";

/** Applies or advances one reserved school transfer. */
const finalizeSchoolTransfer = Effect.fn(
  "auth.deletion.finalizeSchoolTransfer"
)(function* (
  user: Docs["users"],
  transfer: Docs["accountDeletionSchoolTransfers"],
  finalizedAt: number
) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const school = yield* database
    .table("schools")
    .get(transfer.schoolId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (!school || school.createdBy !== user._id) {
    yield* writer.table("accountDeletionSchoolTransfers").delete(transfer._id);
    return {
      needsContinuation: false,
      usedPagination: false,
    };
  }
  const reservedMembership = yield* database
    .table("schoolMembers")
    .get(transfer.successorMembershipId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  const reservedUser = yield* database
    .table("users")
    .get(transfer.successorUserId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
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
      school._id,
      user._id,
      transfer.successorCursor ?? null
    );
    if (successor.kind === "continue") {
      yield* writer
        .table("accountDeletionSchoolTransfers")
        .patch(transfer._id, {
          successorCursor: successor.cursor,
        })
        .pipe(Effect.orDie);
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
    yield* writer
      .table("schoolMembers")
      .patch(successorMembership._id, {
        role: "admin",
        updatedAt: finalizedAt,
      })
      .pipe(Effect.orDie);
  }
  if (successorMembership) {
    yield* writer
      .table("schools")
      .patch(school._id, {
        createdBy: successorMembership.userId,
        updatedAt: finalizedAt,
        updatedBy: successorMembership.userId,
      })
      .pipe(Effect.orDie);
  }

  /*
   * Normal writers cannot invalidate a reservation: successor deletion is
   * blocked and memberships have no removal mutation. If manually corrupted
   * data has no fallback successor, retain the shared school on the anonymous
   * owner tombstone instead of deleting institutional data.
   */
  yield* writer.table("accountDeletionSchoolTransfers").delete(transfer._id);
  return {
    needsContinuation: !hasValidReservation,
    usedPagination: !hasValidReservation,
  };
});

/** Finalizes a bounded transfer batch, stopping after one successor pagination. */
export const finalizeSchoolTransfers = Effect.fn(
  "auth.deletion.finalizeSchoolTransfers"
)(
  function* (
    user: Docs["users"],
    preparationId: Id<"accountDeletionPreparations">,
    finalizedAt: number
  ) {
    const database = yield* DatabaseReader;
    const transfers = yield* database
      .table("accountDeletionSchoolTransfers")
      .index("by_preparationId", (query) =>
        query.eq("preparationId", preparationId)
      )
      .take(ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE + 1)
      .pipe(Effect.orDie);
    let needsContinuation =
      transfers.length > ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE;
    for (const transfer of Arr.take(
      transfers,
      ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE
    )) {
      const finalization = yield* finalizeSchoolTransfer(
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
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
