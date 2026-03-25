import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/functions";
import { v } from "convex/values";

const NOTIFICATION_PREFERENCES_CLEANUP_BATCH_SIZE = 10;
const NOTIFICATION_ENTITY_MUTES_CLEANUP_BATCH_SIZE = 25;
const NOTIFICATION_COUNT_CLEANUP_BATCH_SIZE = 10;
const NOTIFICATION_RECIPIENT_CLEANUP_BATCH_SIZE = 25;
const NOTIFICATION_ACTOR_CLEANUP_BATCH_SIZE = 25;

/** Deletes one user's local auth-related rows in bounded batches. */
export const cleanupDeletedUser = internalMutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const notificationPreferences = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(NOTIFICATION_PREFERENCES_CLEANUP_BATCH_SIZE);

    for (const preference of notificationPreferences) {
      await ctx.db.delete("notificationPreferences", preference._id);
    }

    if (
      notificationPreferences.length ===
      NOTIFICATION_PREFERENCES_CLEANUP_BATCH_SIZE
    ) {
      await ctx.scheduler.runAfter(
        0,
        internal.auth.cleanup.cleanupDeletedUser,
        args
      );

      return null;
    }

    const notificationEntityMutes = await ctx.db
      .query("notificationEntityMutes")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(NOTIFICATION_ENTITY_MUTES_CLEANUP_BATCH_SIZE);

    for (const mutedEntity of notificationEntityMutes) {
      await ctx.db.delete("notificationEntityMutes", mutedEntity._id);
    }

    if (
      notificationEntityMutes.length ===
      NOTIFICATION_ENTITY_MUTES_CLEANUP_BATCH_SIZE
    ) {
      await ctx.scheduler.runAfter(
        0,
        internal.auth.cleanup.cleanupDeletedUser,
        args
      );

      return null;
    }

    const notificationCounts = await ctx.db
      .query("notificationCounts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(NOTIFICATION_COUNT_CLEANUP_BATCH_SIZE);

    for (const count of notificationCounts) {
      await ctx.db.delete("notificationCounts", count._id);
    }

    if (notificationCounts.length === NOTIFICATION_COUNT_CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        0,
        internal.auth.cleanup.cleanupDeletedUser,
        args
      );

      return null;
    }

    const notificationsByRecipient = await ctx.db
      .query("notifications")
      .withIndex("by_recipientId", (q) => q.eq("recipientId", args.userId))
      .take(NOTIFICATION_RECIPIENT_CLEANUP_BATCH_SIZE);

    for (const notification of notificationsByRecipient) {
      await ctx.db.delete("notifications", notification._id);
    }

    if (
      notificationsByRecipient.length ===
      NOTIFICATION_RECIPIENT_CLEANUP_BATCH_SIZE
    ) {
      await ctx.scheduler.runAfter(
        0,
        internal.auth.cleanup.cleanupDeletedUser,
        args
      );

      return null;
    }

    const notificationsByActor = await ctx.db
      .query("notifications")
      .withIndex("by_actorId", (q) => q.eq("actorId", args.userId))
      .take(NOTIFICATION_ACTOR_CLEANUP_BATCH_SIZE);

    for (const notification of notificationsByActor) {
      await ctx.db.delete("notifications", notification._id);
    }

    if (notificationsByActor.length === NOTIFICATION_ACTOR_CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        0,
        internal.auth.cleanup.cleanupDeletedUser,
        args
      );

      return null;
    }

    const user = await ctx.db.get("users", args.userId);

    if (!user) {
      return null;
    }

    await ctx.db.delete("users", args.userId);
    return null;
  },
});
