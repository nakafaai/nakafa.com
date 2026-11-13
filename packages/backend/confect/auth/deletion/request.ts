import authInternal from "@repo/backend/confect/_generated/refs/auth.server";
import { components } from "@repo/backend/confect/_generated/components";
import {
  DatabaseWriter,
  MutationCtx,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { Array as Arr, Clock, Duration, Effect } from "effect";

/**
 * Deletes the signed-in account in one transaction: every Convex Auth session
 * of the account ends, its school username is freed, and the account is marked
 * deleted, so no session, grant or write reaches it from this commit on. The
 * scheduled finalize then releases its Persons, writes the tombstone and starts
 * the durable cleanup of its data (`deletion/finalize`).
 */
export const deleteCurrentAccount = Effect.fn("auth.deletion.request")(
  function* () {
    const { appUser } = yield* requireAuth();
    const ctx = yield* MutationCtx;
    const userId = appUser._id;
    // Convex Auth keeps at most 100 sessions of one user, so one page holds them all.
    const sessions = yield* Effect.promise(() =>
      ctx.runQuery(components.auth.public.listSessions, { userId })
    );
    yield* Effect.promise(() =>
      ctx.runMutation(components.auth.public.revokeSessions, {
        sessionIds: Arr.map(sessions, ({ sessionId }) => sessionId),
      })
    );
    yield* Effect.promise(() =>
      ctx.runMutation(components.authUsername.public.deleteUsername, {
        userId,
      })
    );
    yield* (yield* DatabaseWriter)
      .table("users")
      .patch(userId, { deletedAt: yield* Clock.currentTimeMillis })
      .pipe(Effect.orDie);
    yield* (yield* Scheduler).runAfter(
      Duration.zero,
      authInternal.deletion.workflow.finalize,
      { userId }
    );
    return null;
  }
);
