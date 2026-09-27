import { DatabaseReader } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  toUserCleanupError,
  type UserCleanupError,
} from "@repo/backend/confect/auth/cleanup/spec";
import {
  cancelPreparedAccountDeletion,
  hasAccountDeletionCancellation,
} from "@repo/backend/confect/auth/deletion/cancel";
import { accountDeletionCancellationOutcome } from "@repo/backend/confect/auth/deletion/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect, flow } from "effect";

/** Cancels only the browser attempt that created the active preparation. */
export const cancelAccountDeletionAttempt = Effect.fn(
  "auth.deletion.attemptCancellation.cancel"
)(
  function* (ctx: MutationCtx, authId: string, attemptId: string) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const preparation = yield* database
      .table("accountDeletionPreparations")
      .get("by_authId", authId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (
      !preparation ||
      preparation.deletionStartedAt !== undefined ||
      preparation.finalizedAt !== undefined ||
      preparation.attemptId !== attemptId
    ) {
      return false;
    }
    return yield* cancelPreparedAccountDeletion(ctx, {
      ...preparation,
      attemptId,
    });
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/**
 * Cancels a browser-owned attempt only while the Better Auth user still
 * exists. The unguessable attempt ID is the narrow recovery capability.
 */
export const cancelAccountDeletionAttemptByToken = Effect.fn(
  "auth.deletion.attemptCancellation.cancelByToken"
)(
  function* (
    ctx: MutationCtx,
    attemptId: string,
    authUserExists: (authId: string) => Effect.Effect<boolean, UserCleanupError>
  ) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const preparation = yield* database
      .table("accountDeletionPreparations")
      .get("by_attemptId", attemptId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!preparation) {
      return (yield* hasAccountDeletionCancellation(ctx, attemptId))
        ? accountDeletionCancellationOutcome.complete
        : null;
    }
    if (
      preparation.deletionStartedAt !== undefined ||
      preparation.finalizedAt !== undefined
    ) {
      return null;
    }
    const userStillExists = yield* authUserExists(preparation.authId);
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
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
