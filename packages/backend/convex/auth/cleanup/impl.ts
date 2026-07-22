import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { cleanupUserNotifications } from "@repo/backend/convex/auth/cleanup/notifications";
import { tryUserCleanup } from "@repo/backend/convex/auth/cleanup/spec";
import { cleanupUserTryouts } from "@repo/backend/convex/auth/cleanup/tryouts";
import { makeFunctionReference } from "convex/server";
import { Effect } from "effect";

const cleanupDeletedUserReference = makeFunctionReference<
  "mutation",
  { userId: Id<"users"> },
  null
>("auth/cleanup:cleanupDeletedUser");

/** Re-schedules cleanup so every mutation remains within transaction limits. */
const scheduleRetry = Effect.fn("auth.cleanup.scheduleRetry")(function* (
  ctx: Pick<MutationCtx, "scheduler">,
  userId: Id<"users">
) {
  yield* tryUserCleanup(() =>
    ctx.scheduler.runAfter(0, cleanupDeletedUserReference, {
      userId,
    })
  );
});

/** Deletes one user's bounded local app data and finally the app user row. */
export const cleanupDeletedUserProgram = Effect.fn(
  "auth.cleanup.cleanupDeletedUser"
)(function* (ctx: MutationCtx, userId: Id<"users">) {
  if (yield* cleanupUserNotifications(ctx, userId)) {
    yield* scheduleRetry(ctx, userId);
    return null;
  }

  if (yield* cleanupUserTryouts(ctx, userId)) {
    yield* scheduleRetry(ctx, userId);
    return null;
  }

  const user = yield* tryUserCleanup(() => ctx.db.get("users", userId));

  if (user) {
    yield* tryUserCleanup(() => ctx.db.delete("users", userId));
  }

  return null;
});
