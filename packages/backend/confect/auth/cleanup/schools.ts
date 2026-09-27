import { DatabaseReader, DatabaseWriter } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect, flow } from "effect";

const MEMBERSHIP_BATCH_SIZE = 25;
const ACTIVITY_BATCH_SIZE = 50;
const ACTIVITY_REFERENCE_BATCH_SIZE = 25;

/** Deletes one bounded batch of school and class memberships. */
const cleanupMemberships = Effect.fn("auth.cleanup.cleanupMemberships")(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const classMemberships = yield* database
      .table("schoolClassMembers")
      .index("by_userId", (query) => query.eq("userId", userId))
      .take(MEMBERSHIP_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const membership of classMemberships) {
      yield* writer.table("schoolClassMembers").delete(membership._id);
    }
    if (classMemberships.length > 0) {
      return true;
    }
    const schoolMemberships = yield* database
      .table("schoolMembers")
      .index("by_userId_and_status", (query) => query.eq("userId", userId))
      .take(MEMBERSHIP_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const membership of schoolMemberships) {
      yield* writer.table("schoolMembers").delete(membership._id);
    }
    return schoolMemberships.length > 0;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Deletes one bounded batch of school audit rows containing user metadata. */
const cleanupActivity = Effect.fn("auth.cleanup.cleanupSchoolActivity")(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const inviteRows = yield* database
      .table("schoolActivityLogs")
      .index("by_metadata_invitedUserId", (query) =>
        query.eq("metadata.invitedUserId", userId)
      )
      .take(ACTIVITY_REFERENCE_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const activity of inviteRows) {
      yield* writer.table("schoolActivityLogs").delete(activity._id);
    }
    if (inviteRows.length > 0) {
      return true;
    }
    const addedRows = yield* database
      .table("schoolActivityLogs")
      .index("by_metadata_addedUserId", (query) =>
        query.eq("metadata.addedUserId", userId)
      )
      .take(ACTIVITY_REFERENCE_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const activity of addedRows) {
      yield* writer.table("schoolActivityLogs").delete(activity._id);
    }
    if (addedRows.length > 0) {
      return true;
    }
    const removedRows = yield* database
      .table("schoolActivityLogs")
      .index("by_metadata_removedUserId", (query) =>
        query.eq("metadata.removedUserId", userId)
      )
      .take(ACTIVITY_REFERENCE_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const activity of removedRows) {
      yield* writer.table("schoolActivityLogs").delete(activity._id);
    }
    if (removedRows.length > 0) {
      return true;
    }
    const activityRows = yield* database
      .table("schoolActivityLogs")
      .index("by_userId", (query) => query.eq("userId", userId))
      .take(ACTIVITY_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const activity of activityRows) {
      yield* writer.table("schoolActivityLogs").delete(activity._id);
    }
    return activityRows.length > 0;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
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
