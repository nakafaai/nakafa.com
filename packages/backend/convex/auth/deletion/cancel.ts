import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  tryUserCleanup,
  type UserCleanupError,
} from "@repo/backend/convex/auth/cleanup/spec";
import { ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE } from "@repo/backend/convex/auth/deletion/constants";
import type { AccountDeletionPreparationVersion } from "@repo/backend/convex/auth/deletion/spec";
import { Effect } from "effect";

/** Removes one bounded reservation batch and then its empty preparation. */
export const deleteAccountDeletionPreparation = Effect.fn(
  "auth.deletion.deleteAccountDeletionPreparation"
)(function* (
  ctx: MutationCtx,
  preparation: Doc<"accountDeletionPreparations">
) {
  const transfers = yield* tryUserCleanup(() =>
    ctx.db
      .query("accountDeletionSchoolTransfers")
      .withIndex("by_preparationId", (query) =>
        query.eq("preparationId", preparation._id)
      )
      .take(ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE + 1)
  );

  for (const transfer of transfers.slice(
    0,
    ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE
  )) {
    yield* tryUserCleanup(() =>
      ctx.db.delete("accountDeletionSchoolTransfers", transfer._id)
    );
  }

  if (transfers.length > ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE) {
    return true;
  }

  yield* tryUserCleanup(() =>
    ctx.db.delete("accountDeletionPreparations", preparation._id)
  );
  return false;
});

/** Restores app access after Better Auth aborts before removing the auth user. */
export const cancelAccountDeletion: (
  ctx: MutationCtx,
  authId: string,
  expectedPreparation: AccountDeletionPreparationVersion
) => Effect.Effect<boolean, UserCleanupError> = Effect.fn(
  "auth.deletion.cancelAccountDeletion"
)(function* (
  ctx: MutationCtx,
  authId: string,
  expectedPreparation: AccountDeletionPreparationVersion
) {
  const preparation = yield* tryUserCleanup(() =>
    ctx.db
      .query("accountDeletionPreparations")
      .withIndex("by_authId", (query) => query.eq("authId", authId))
      .unique()
  );

  if (
    !preparation ||
    preparation.finalizedAt !== undefined ||
    preparation.attemptId !== expectedPreparation.attemptId ||
    preparation._id !== expectedPreparation.preparationId ||
    preparation.recoveryGeneration !== expectedPreparation.recoveryGeneration
  ) {
    return false;
  }

  const user = yield* tryUserCleanup(() =>
    ctx.db.get("users", preparation.userId)
  );

  if (user?.deletionPreparedAt !== undefined) {
    yield* tryUserCleanup(() =>
      ctx.db.patch("users", preparation.userId, {
        deletionPreparedAt: undefined,
      })
    );
  }

  return yield* deleteAccountDeletionPreparation(ctx, preparation);
});

/** Cancels only the browser attempt that created the active preparation. */
export const cancelAccountDeletionAttempt = Effect.fn(
  "auth.deletion.cancelAccountDeletionAttempt"
)(function* (ctx: MutationCtx, authId: string, attemptId: string) {
  const preparation = yield* tryUserCleanup(() =>
    ctx.db
      .query("accountDeletionPreparations")
      .withIndex("by_authId", (query) => query.eq("authId", authId))
      .unique()
  );

  if (
    !preparation ||
    preparation.finalizedAt !== undefined ||
    preparation.attemptId !== attemptId
  ) {
    return false;
  }

  const user = yield* tryUserCleanup(() =>
    ctx.db.get("users", preparation.userId)
  );

  if (user?.deletionPreparedAt !== undefined) {
    yield* tryUserCleanup(() =>
      ctx.db.patch("users", preparation.userId, {
        deletionPreparedAt: undefined,
      })
    );
  }

  return yield* deleteAccountDeletionPreparation(ctx, preparation);
});

/** Removes finalized preparation metadata once its cleanup workflow is active. */
export const cleanupFinalizedAccountDeletion: (
  ctx: MutationCtx,
  userId: Id<"users">
) => Effect.Effect<boolean, UserCleanupError> = Effect.fn(
  "auth.deletion.cleanupFinalizedAccountDeletion"
)(function* (ctx: MutationCtx, userId: Id<"users">) {
  const preparation = yield* tryUserCleanup(() =>
    ctx.db
      .query("accountDeletionPreparations")
      .withIndex("by_userId", (query) => query.eq("userId", userId))
      .unique()
  );

  if (!preparation) {
    return false;
  }

  yield* deleteAccountDeletionPreparation(ctx, preparation);
  return true;
});
