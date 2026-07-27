import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { tryUserCleanup } from "@repo/backend/convex/auth/cleanup/spec";
import { Effect } from "effect";

const MEMBERSHIP_BATCH_SIZE = 25;
const ACTIVITY_BATCH_SIZE = 50;
const ACTIVITY_REFERENCE_BATCH_SIZE = 25;

/** Deletes one bounded batch of school and class memberships. */
const cleanupMemberships = Effect.fn("auth.cleanup.cleanupMemberships")(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const classMemberships = yield* tryUserCleanup(() =>
      ctx.db
        .query("schoolClassMembers")
        .withIndex("by_userId", (query) => query.eq("userId", userId))
        .take(MEMBERSHIP_BATCH_SIZE)
    );

    for (const membership of classMemberships) {
      yield* tryUserCleanup(() =>
        ctx.db.delete("schoolClassMembers", membership._id)
      );
    }

    if (classMemberships.length > 0) {
      return true;
    }

    const schoolMemberships = yield* tryUserCleanup(() =>
      ctx.db
        .query("schoolMembers")
        .withIndex("by_userId_and_status", (query) =>
          query.eq("userId", userId)
        )
        .take(MEMBERSHIP_BATCH_SIZE)
    );

    for (const membership of schoolMemberships) {
      yield* tryUserCleanup(() =>
        ctx.db.delete("schoolMembers", membership._id)
      );
    }

    return schoolMemberships.length > 0;
  }
);

/** Deletes one bounded batch of school audit rows containing user metadata. */
const cleanupActivity = Effect.fn("auth.cleanup.cleanupSchoolActivity")(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const inviteRows = yield* tryUserCleanup(() =>
      ctx.db
        .query("schoolActivityLogs")
        .withIndex("by_metadata_invitedUserId", (query) =>
          query.eq("metadata.invitedUserId", userId)
        )
        .take(ACTIVITY_REFERENCE_BATCH_SIZE)
    );

    for (const activity of inviteRows) {
      yield* tryUserCleanup(() =>
        ctx.db.delete("schoolActivityLogs", activity._id)
      );
    }

    if (inviteRows.length > 0) {
      return true;
    }

    const addedRows = yield* tryUserCleanup(() =>
      ctx.db
        .query("schoolActivityLogs")
        .withIndex("by_metadata_addedUserId", (query) =>
          query.eq("metadata.addedUserId", userId)
        )
        .take(ACTIVITY_REFERENCE_BATCH_SIZE)
    );

    for (const activity of addedRows) {
      yield* tryUserCleanup(() =>
        ctx.db.delete("schoolActivityLogs", activity._id)
      );
    }

    if (addedRows.length > 0) {
      return true;
    }

    const removedRows = yield* tryUserCleanup(() =>
      ctx.db
        .query("schoolActivityLogs")
        .withIndex("by_metadata_removedUserId", (query) =>
          query.eq("metadata.removedUserId", userId)
        )
        .take(ACTIVITY_REFERENCE_BATCH_SIZE)
    );

    for (const activity of removedRows) {
      yield* tryUserCleanup(() =>
        ctx.db.delete("schoolActivityLogs", activity._id)
      );
    }

    if (removedRows.length > 0) {
      return true;
    }

    const activityRows = yield* tryUserCleanup(() =>
      ctx.db
        .query("schoolActivityLogs")
        .withIndex("by_userId", (query) => query.eq("userId", userId))
        .take(ACTIVITY_BATCH_SIZE)
    );

    for (const activity of activityRows) {
      yield* tryUserCleanup(() =>
        ctx.db.delete("schoolActivityLogs", activity._id)
      );
    }

    return activityRows.length > 0;
  }
);

/**
 * Deletes memberships before activity rows so membership triggers cannot
 * recreate account-linked audit data after the final cleanup pass.
 */
export const cleanupUserSchoolData = Effect.fn(
  "auth.cleanup.cleanupUserSchoolData"
)(function* (ctx: MutationCtx, userId: Id<"users">) {
  if (yield* cleanupMemberships(ctx, userId)) {
    return true;
  }

  return yield* cleanupActivity(ctx, userId);
});
