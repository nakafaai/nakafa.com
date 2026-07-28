import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  tryUserCleanup,
  type UserCleanupError,
} from "@repo/backend/convex/auth/cleanup/spec";
import { deleteAccountDeletionPreparation } from "@repo/backend/convex/auth/deletion/cancel";
import { ACCOUNT_DELETION_RECOVERY_DELAY_MS } from "@repo/backend/convex/auth/deletion/constants";
import {
  type AccountDeletionPreparationOutcome,
  accountDeletionPreparationOutcome,
} from "@repo/backend/convex/auth/deletion/spec";
import { findSchoolOwnershipSuccessorPage } from "@repo/backend/convex/auth/deletion/successor";
import { Clock, Effect } from "effect";

type AccountDeletionPreparation = Doc<"accountDeletionPreparations">;
type AppUser = Doc<"users">;

/** Marks a fully reserved preparation ready and refreshes its recovery lease. */
const completePreparation = Effect.fn("auth.deletion.completePreparation")(
  function* (
    ctx: MutationCtx,
    user: AppUser,
    preparation: AccountDeletionPreparation
  ) {
    const readyAt = yield* Clock.currentTimeMillis;
    const recoveryGeneration = preparation.recoveryGeneration + 1;

    yield* tryUserCleanup(() =>
      ctx.db.patch("accountDeletionPreparations", preparation._id, {
        pendingSchoolId: undefined,
        pendingSchoolNextCursor: undefined,
        readyAt,
        recoveryAt: readyAt + ACCOUNT_DELETION_RECOVERY_DELAY_MS,
        recoveryGeneration,
        schoolCursor: undefined,
        successorCursor: undefined,
      })
    );
    yield* tryUserCleanup(() =>
      ctx.db.patch("users", user._id, { deletionPreparedAt: readyAt })
    );
  }
);

/** Advances one bounded, cursor-backed school reservation transaction. */
const reserveSchoolSuccessors = Effect.fn(
  "auth.deletion.reserveSchoolSuccessors"
)(function* (
  ctx: MutationCtx,
  user: AppUser,
  preparation: AccountDeletionPreparation
) {
  const schoolCursor = preparation.schoolCursor ?? null;
  let pendingSchoolId = preparation.pendingSchoolId;
  let pendingSchoolNextCursor = preparation.pendingSchoolNextCursor;
  let successorCursor = preparation.successorCursor ?? null;

  if (!pendingSchoolId) {
    const schoolPage = yield* tryUserCleanup(() =>
      ctx.db
        .query("schools")
        .withIndex("by_createdBy", (query) => query.eq("createdBy", user._id))
        .paginate({ cursor: schoolCursor, numItems: 1 })
    );
    const school = schoolPage.page[0];

    if (!school) {
      return accountDeletionPreparationOutcome.ready;
    }

    pendingSchoolId = school._id;
    pendingSchoolNextCursor = schoolPage.continueCursor;
    successorCursor = null;
    yield* tryUserCleanup(() =>
      ctx.db.patch("accountDeletionPreparations", preparation._id, {
        pendingSchoolId,
        pendingSchoolNextCursor,
        schoolCursor: schoolCursor ?? undefined,
        successorCursor: undefined,
      })
    );
    return accountDeletionPreparationOutcome.continue;
  }

  const school = yield* tryUserCleanup(() =>
    ctx.db.get("schools", pendingSchoolId)
  );

  if (!school || school.createdBy !== user._id) {
    yield* tryUserCleanup(() =>
      ctx.db.patch("accountDeletionPreparations", preparation._id, {
        pendingSchoolId: undefined,
        pendingSchoolNextCursor: undefined,
        schoolCursor: pendingSchoolNextCursor,
        successorCursor: undefined,
      })
    );
    return accountDeletionPreparationOutcome.continue;
  }

  const successor = yield* findSchoolOwnershipSuccessorPage(
    ctx,
    school._id,
    user._id,
    successorCursor
  );

  if (successor.kind === "continue") {
    yield* tryUserCleanup(() =>
      ctx.db.patch("accountDeletionPreparations", preparation._id, {
        pendingSchoolId: school._id,
        pendingSchoolNextCursor,
        schoolCursor: schoolCursor ?? undefined,
        successorCursor: successor.cursor,
      })
    );
    return accountDeletionPreparationOutcome.continue;
  }

  if (successor.kind === "not-found") {
    yield* tryUserCleanup(() =>
      ctx.db.patch("users", user._id, {
        deletionPreparedAt: undefined,
      })
    );
    yield* deleteAccountDeletionPreparation(ctx, preparation);
    return accountDeletionPreparationOutcome.schoolSuccessorRequired;
  }

  yield* tryUserCleanup(() =>
    ctx.db.insert("accountDeletionSchoolTransfers", {
      preparationId: preparation._id,
      schoolId: school._id,
      successorMembershipId: successor.successorMembership._id,
      successorUserId: successor.successorMembership.userId,
    })
  );
  yield* tryUserCleanup(() =>
    ctx.db.patch("accountDeletionPreparations", preparation._id, {
      pendingSchoolId: undefined,
      pendingSchoolNextCursor: undefined,
      schoolCursor: pendingSchoolNextCursor,
      successorCursor: undefined,
    })
  );
  return accountDeletionPreparationOutcome.continue;
});

/** Creates or advances the exact browser attempt's durable preparation. */
export const prepareAccountDeletion: (
  ctx: MutationCtx,
  authId: string,
  attemptId: string
) => Effect.Effect<AccountDeletionPreparationOutcome, UserCleanupError> =
  Effect.fn("auth.deletion.prepareAccountDeletion")(function* (
    ctx: MutationCtx,
    authId: string,
    attemptId: string
  ) {
    const user = yield* tryUserCleanup(() =>
      ctx.db
        .query("users")
        .withIndex("by_authId", (query) => query.eq("authId", authId))
        .unique()
    );

    if (!user || user.deletedAt !== undefined) {
      return accountDeletionPreparationOutcome.ready;
    }

    let preparation = yield* tryUserCleanup(() =>
      ctx.db
        .query("accountDeletionPreparations")
        .withIndex("by_authId", (query) => query.eq("authId", authId))
        .unique()
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

    if (preparation?.readyAt !== undefined) {
      yield* completePreparation(ctx, user, preparation);
      return accountDeletionPreparationOutcome.ready;
    }

    if (!preparation) {
      const successorReservation = yield* tryUserCleanup(() =>
        ctx.db
          .query("accountDeletionSchoolTransfers")
          .withIndex("by_successorUserId", (query) =>
            query.eq("successorUserId", user._id)
          )
          .first()
      );

      if (successorReservation) {
        return accountDeletionPreparationOutcome.temporarilyUnavailable;
      }

      const preparationStartedAt = yield* Clock.currentTimeMillis;
      const preparationId = yield* tryUserCleanup(() =>
        ctx.db.insert("accountDeletionPreparations", {
          attemptId,
          authId,
          recoveryAt: preparationStartedAt + ACCOUNT_DELETION_RECOVERY_DELAY_MS,
          recoveryGeneration: 0,
          userId: user._id,
        })
      );
      yield* tryUserCleanup(() =>
        ctx.db.patch("users", user._id, {
          deletionPreparedAt: preparationStartedAt,
        })
      );
      preparation = yield* tryUserCleanup(() =>
        ctx.db.get("accountDeletionPreparations", preparationId)
      );

      if (!preparation) {
        return accountDeletionPreparationOutcome.temporarilyUnavailable;
      }
    }

    const outcome = yield* reserveSchoolSuccessors(ctx, user, preparation);

    if (outcome === accountDeletionPreparationOutcome.ready) {
      yield* completePreparation(ctx, user, preparation);
      return accountDeletionPreparationOutcome.ready;
    }

    return outcome;
  });
