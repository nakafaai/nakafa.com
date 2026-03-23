import { mutation } from "@repo/backend/convex/_generated/server";
import { requireAuthWithSession } from "@repo/backend/convex/lib/helpers/auth";
import {
  emailDigestTypesValidator,
  notificationEntityIdValidator,
  notificationEntityTypesValidator,
  notificationTypesValidator,
} from "@repo/backend/convex/notifications/schema";
import { v } from "convex/values";

/** Updates the current user's email notification settings. */
export const updateNotificationPreferences = mutation({
  args: {
    emailDigest: emailDigestTypesValidator,
    emailEnabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);
    const preferences = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", user.appUser._id))
      .first();

    const updatedAt = Date.now();

    if (preferences) {
      await ctx.db.patch("notificationPreferences", preferences._id, {
        emailDigest: args.emailDigest,
        emailEnabled: args.emailEnabled,
        updatedAt,
      });

      return null;
    }

    await ctx.db.insert("notificationPreferences", {
      disabledTypes: [],
      emailDigest: args.emailDigest,
      emailEnabled: args.emailEnabled,
      updatedAt,
      userId: user.appUser._id,
    });

    return null;
  },
});

/** Replaces the current user's disabled notification types. */
export const setDisabledNotificationTypes = mutation({
  args: {
    disabledTypes: v.array(notificationTypesValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);
    const preferences = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", user.appUser._id))
      .first();

    const updatedAt = Date.now();

    if (preferences) {
      await ctx.db.patch("notificationPreferences", preferences._id, {
        disabledTypes: args.disabledTypes,
        updatedAt,
      });
    } else {
      await ctx.db.insert("notificationPreferences", {
        disabledTypes: args.disabledTypes,
        emailDigest: "weekly",
        emailEnabled: true,
        updatedAt,
        userId: user.appUser._id,
      });
    }

    return null;
  },
});

/** Mutes or unmutes one entity for the current user. */
export const setNotificationEntityMute = mutation({
  args: {
    entityId: notificationEntityIdValidator,
    entityType: notificationEntityTypesValidator,
    muted: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);
    const existingRows = await ctx.db
      .query("notificationEntityMutes")
      .withIndex("by_userId_entityType_entityId", (q) =>
        q
          .eq("userId", user.appUser._id)
          .eq("entityType", args.entityType)
          .eq("entityId", args.entityId)
      )
      .collect();

    if (!args.muted) {
      for (const row of existingRows) {
        await ctx.db.delete("notificationEntityMutes", row._id);
      }

      return null;
    }

    if (existingRows.length > 0) {
      for (const row of existingRows.slice(1)) {
        await ctx.db.delete("notificationEntityMutes", row._id);
      }

      return null;
    }

    await ctx.db.insert("notificationEntityMutes", {
      entityId: args.entityId,
      entityType: args.entityType,
      mutedAt: Date.now(),
      userId: user.appUser._id,
    });

    return null;
  },
});
