import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { tryUserCleanup } from "@repo/backend/convex/auth/cleanup/spec";
import { Effect } from "effect";

const PREFERENCES_BATCH_SIZE = 10;
const ENTITY_MUTES_BATCH_SIZE = 25;
const COUNT_BATCH_SIZE = 10;
const RECIPIENT_BATCH_SIZE = 25;
const ACTOR_BATCH_SIZE = 25;

/** Deletes one bounded batch from every notification table owned by a user. */
export const cleanupUserNotifications = Effect.fn(
  "auth.cleanup.cleanupUserNotifications"
)(function* (ctx: MutationCtx, userId: Id<"users">) {
  const preferences = yield* tryUserCleanup(() =>
    ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (query) => query.eq("userId", userId))
      .take(PREFERENCES_BATCH_SIZE)
  );

  for (const preference of preferences) {
    yield* tryUserCleanup(() =>
      ctx.db.delete("notificationPreferences", preference._id)
    );
  }

  if (preferences.length === PREFERENCES_BATCH_SIZE) {
    return true;
  }

  const entityMutes = yield* tryUserCleanup(() =>
    ctx.db
      .query("notificationEntityMutes")
      .withIndex("by_userId", (query) => query.eq("userId", userId))
      .take(ENTITY_MUTES_BATCH_SIZE)
  );

  for (const entityMute of entityMutes) {
    yield* tryUserCleanup(() =>
      ctx.db.delete("notificationEntityMutes", entityMute._id)
    );
  }

  if (entityMutes.length === ENTITY_MUTES_BATCH_SIZE) {
    return true;
  }

  const counts = yield* tryUserCleanup(() =>
    ctx.db
      .query("notificationCounts")
      .withIndex("by_userId", (query) => query.eq("userId", userId))
      .take(COUNT_BATCH_SIZE)
  );

  for (const count of counts) {
    yield* tryUserCleanup(() => ctx.db.delete("notificationCounts", count._id));
  }

  if (counts.length === COUNT_BATCH_SIZE) {
    return true;
  }

  const received = yield* tryUserCleanup(() =>
    ctx.db
      .query("notifications")
      .withIndex("by_recipientId", (query) => query.eq("recipientId", userId))
      .take(RECIPIENT_BATCH_SIZE)
  );

  for (const notification of received) {
    yield* tryUserCleanup(() =>
      ctx.db.delete("notifications", notification._id)
    );
  }

  if (received.length === RECIPIENT_BATCH_SIZE) {
    return true;
  }

  const acted = yield* tryUserCleanup(() =>
    ctx.db
      .query("notifications")
      .withIndex("by_actorId", (query) => query.eq("actorId", userId))
      .take(ACTOR_BATCH_SIZE)
  );

  for (const notification of acted) {
    yield* tryUserCleanup(() =>
      ctx.db.delete("notifications", notification._id)
    );
  }

  return acted.length === ACTOR_BATCH_SIZE;
});
