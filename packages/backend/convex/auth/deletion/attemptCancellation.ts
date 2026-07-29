import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { tryUserCleanup } from "@repo/backend/convex/auth/cleanup/spec";
import { deleteAccountDeletionPreparation } from "@repo/backend/convex/auth/deletion/cancel";
import { accountDeletionCancellationOutcome } from "@repo/backend/convex/auth/deletion/spec";
import { Effect } from "effect";

/** Cancels only the browser attempt that created the active preparation. */
export const cancelAccountDeletionAttempt = Effect.fn(
  "auth.deletion.attemptCancellation.cancel"
)(function* (ctx: MutationCtx, authId: string, attemptId: string) {
  const preparation = yield* tryUserCleanup(() =>
    ctx.db
      .query("accountDeletionPreparations")
      .withIndex("by_authId", (query) => query.eq("authId", authId))
      .unique()
  );

  if (
    !preparation ||
    preparation.deletionStartedAt !== undefined ||
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

/**
 * Cancels a browser-owned attempt only while the Better Auth user still
 * exists. The unguessable attempt ID is the narrow recovery capability.
 */
export const cancelAccountDeletionAttemptByToken = Effect.fn(
  "auth.deletion.attemptCancellation.cancelByToken"
)(function* (
  ctx: MutationCtx,
  attemptId: string,
  authUserExists: (authId: string) => Promise<boolean>
) {
  const preparation = yield* tryUserCleanup(() =>
    ctx.db
      .query("accountDeletionPreparations")
      .withIndex("by_attemptId", (query) => query.eq("attemptId", attemptId))
      .unique()
  );

  if (!preparation) {
    return accountDeletionCancellationOutcome.complete;
  }

  if (
    preparation.deletionStartedAt !== undefined ||
    preparation.finalizedAt !== undefined
  ) {
    return null;
  }

  const userStillExists = yield* tryUserCleanup(() =>
    authUserExists(preparation.authId)
  );

  if (!userStillExists) {
    return null;
  }

  const hasMore = yield* cancelAccountDeletionAttempt(
    ctx,
    preparation.authId,
    attemptId
  );

  return hasMore
    ? accountDeletionCancellationOutcome.continue
    : accountDeletionCancellationOutcome.complete;
});
