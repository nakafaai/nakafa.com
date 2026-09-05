import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  tryUserCleanup,
  type UserCleanupError,
} from "@repo/backend/convex/auth/cleanup/spec";
import { ACCOUNT_DELETION_RECOVERY_DELAY_MS } from "@repo/backend/convex/auth/deletion/constants";
import { prepareAccountDeletion } from "@repo/backend/convex/auth/deletion/prepare";
import {
  type AccountDeletionPreparationOutcome,
  accountDeletionPreparationOutcome,
} from "@repo/backend/convex/auth/deletion/spec";
import { removeWelcomeIntent } from "@repo/backend/convex/emails/welcome/impl";
import { Clock, Effect } from "effect";

/**
 * Claims the irreversible deletion phase only from Better Auth's before-delete
 * hook. Browser preparation remains cancelable until this mutation commits.
 */
export const claimAccountDeletion: (
  ctx: MutationCtx,
  authId: string,
  attemptId: string
) => Effect.Effect<AccountDeletionPreparationOutcome, UserCleanupError> =
  Effect.fn("auth.deletion.claimAccountDeletion")(function* (
    ctx: MutationCtx,
    authId: string,
    attemptId: string
  ) {
    const outcome = yield* prepareAccountDeletion(ctx, authId, attemptId);

    if (outcome !== accountDeletionPreparationOutcome.ready) {
      return outcome;
    }

    const [preparation, user] = yield* Effect.all([
      tryUserCleanup(() =>
        ctx.db
          .query("accountDeletionPreparations")
          .withIndex("by_authId", (query) => query.eq("authId", authId))
          .unique()
      ),
      tryUserCleanup(() =>
        ctx.db
          .query("users")
          .withIndex("by_authId", (query) => query.eq("authId", authId))
          .unique()
      ),
    ]);

    if (!user || user.deletedAt !== undefined) {
      return accountDeletionPreparationOutcome.ready;
    }

    /*
     * For an active user, prepareAccountDeletion returns ready only after the
     * matching preparation and user marker are durable in this transaction.
     * Missing state here is therefore a violated internal invariant, not a
     * recoverable preparation outcome.
     */
    const claimedPreparation = yield* Effect.fromNullishOr(preparation).pipe(
      Effect.orDie
    );

    yield* removeWelcomeIntent(ctx, user._id);
    const deletionStartedAt = yield* Clock.currentTimeMillis;

    yield* tryUserCleanup(() =>
      ctx.db.patch("accountDeletionPreparations", claimedPreparation._id, {
        deletionStartedAt:
          claimedPreparation.deletionStartedAt ?? deletionStartedAt,
        recoveryAt: deletionStartedAt + ACCOUNT_DELETION_RECOVERY_DELAY_MS,
        recoveryGeneration: claimedPreparation.recoveryGeneration + 1,
      })
    );

    return accountDeletionPreparationOutcome.ready;
  });
