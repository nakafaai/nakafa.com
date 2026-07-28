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
import { cancelPendingWelcomeEmail } from "@repo/backend/convex/emails/deletion";
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

    if (
      !preparation ||
      preparation.attemptId !== attemptId ||
      preparation.finalizedAt !== undefined ||
      preparation.readyAt === undefined ||
      user.deletionPreparedAt === undefined
    ) {
      return accountDeletionPreparationOutcome.temporarilyUnavailable;
    }

    yield* cancelPendingWelcomeEmail(ctx, user);
    const deletionStartedAt = yield* Clock.currentTimeMillis;

    yield* tryUserCleanup(() =>
      ctx.db.patch("accountDeletionPreparations", preparation._id, {
        deletionStartedAt: preparation.deletionStartedAt ?? deletionStartedAt,
        recoveryAt: deletionStartedAt + ACCOUNT_DELETION_RECOVERY_DELAY_MS,
        recoveryGeneration: preparation.recoveryGeneration + 1,
      })
    );

    return accountDeletionPreparationOutcome.ready;
  });
