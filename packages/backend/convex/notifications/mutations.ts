import { internal } from "@repo/backend/convex/_generated/api";
import {
  internalMutation,
  mutation,
} from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import {
  emailDigestTypesValidator,
  notificationEntityIdValidator,
  notificationEntityTypesValidator,
  notificationTypesValidator,
} from "@repo/backend/convex/notifications/schema";
import { notificationWorkpool } from "@repo/backend/convex/notifications/workpool";
import { ConvexError, v } from "convex/values";

const NOTIFICATION_ENTITY_MUTE_DUPLICATE_LIMIT = 10;

const notificationCreateArgsValidator = v.object({
  actorId: v.optional(v.id("users")),
  entityId: v.optional(notificationEntityIdValidator),
  entityType: notificationEntityTypesValidator,
  previewBody: v.optional(v.string()),
  previewTitle: v.optional(v.string()),
  recipientId: v.id("users"),
  type: notificationTypesValidator,
});

/** Patch or create one user's notification preferences inside the shared serializer. */
export const applyNotificationPreferencesUpdate = internalMutation({
  args: {
    createDefaults: v.object({
      disabledTypes: v.array(notificationTypesValidator),
      emailDigest: emailDigestTypesValidator,
      emailEnabled: v.boolean(),
    }),
    patch: v.object({
      disabledTypes: v.optional(v.array(notificationTypesValidator)),
      emailDigest: v.optional(emailDigestTypesValidator),
      emailEnabled: v.optional(v.boolean()),
    }),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const preferences = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    const updatedAt = Date.now();

    if (!preferences) {
      await ctx.db.insert("notificationPreferences", {
        ...args.createDefaults,
        updatedAt,
        userId: args.userId,
      });

      return null;
    }

    await ctx.db.patch("notificationPreferences", preferences._id, {
      ...args.patch,
      updatedAt,
    });

    return null;
  },
});

/** Increment one user's unread notification count inside the shared serializer. */
export const incrementUnreadNotificationCount = internalMutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existingCount = await ctx.db
      .query("notificationCounts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (existingCount) {
      await ctx.db.patch("notificationCounts", existingCount._id, {
        unreadCount: existingCount.unreadCount + 1,
        updatedAt: Date.now(),
      });

      return null;
    }

    await ctx.db.insert("notificationCounts", {
      userId: args.userId,
      unreadCount: 1,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/** Create one notification after applying current preference and mute state. */
export const deliverNotificationIfAllowed = internalMutation({
  args: notificationCreateArgsValidator,
  returns: v.null(),
  handler: async (ctx, args) => {
    const preferences = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", args.recipientId))
      .first();

    if (args.entityId && args.entityType !== "system") {
      const entityId = args.entityId;
      const entityType = args.entityType;
      const mutedEntity = await ctx.db
        .query("notificationEntityMutes")
        .withIndex("by_userId_and_entityType_and_entityId", (q) =>
          q
            .eq("userId", args.recipientId)
            .eq("entityType", entityType)
            .eq("entityId", entityId)
        )
        .first();

      if (mutedEntity) {
        return null;
      }
    }

    if (preferences?.disabledTypes.includes(args.type)) {
      return null;
    }

    await ctx.db.insert("notifications", {
      recipientId: args.recipientId,
      actorId: args.actorId,
      type: args.type,
      entityType: args.entityType,
      entityId: args.entityId,
      previewTitle: args.previewTitle,
      previewBody: args.previewBody,
    });

    const existingCount = await ctx.db
      .query("notificationCounts")
      .withIndex("by_userId", (q) => q.eq("userId", args.recipientId))
      .unique();

    if (existingCount) {
      await ctx.db.patch("notificationCounts", existingCount._id, {
        unreadCount: existingCount.unreadCount + 1,
        updatedAt: Date.now(),
      });

      return null;
    }

    await ctx.db.insert("notificationCounts", {
      userId: args.recipientId,
      unreadCount: 1,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/** Decrement one user's unread notification count inside the shared serializer. */
export const decrementUnreadNotificationCount = internalMutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existingCount = await ctx.db
      .query("notificationCounts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!existingCount) {
      return null;
    }

    await ctx.db.patch("notificationCounts", existingCount._id, {
      unreadCount: Math.max(0, existingCount.unreadCount - 1),
      updatedAt: Date.now(),
    });

    return null;
  },
});

/** Apply one notification-entity mute change inside the shared per-user serializer. */
export const applyNotificationEntityMuteUpdate = internalMutation({
  args: {
    entityId: notificationEntityIdValidator,
    entityType: notificationEntityTypesValidator,
    muted: v.boolean(),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existingRows = await ctx.db
      .query("notificationEntityMutes")
      .withIndex("by_userId_and_entityType_and_entityId", (q) =>
        q
          .eq("userId", args.userId)
          .eq("entityType", args.entityType)
          .eq("entityId", args.entityId)
      )
      .take(NOTIFICATION_ENTITY_MUTE_DUPLICATE_LIMIT);

    if (existingRows.length >= NOTIFICATION_ENTITY_MUTE_DUPLICATE_LIMIT) {
      throw new ConvexError({
        code: "NOTIFICATION_ENTITY_MUTE_DUPLICATE_LIMIT_EXCEEDED",
        message: "Notification entity mute duplicate limit exceeded.",
      });
    }

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
      userId: args.userId,
    });

    return null;
  },
});

/** Updates the current user's email notification settings. */
export const updateNotificationPreferences = mutation({
  args: {
    emailDigest: emailDigestTypesValidator,
    emailEnabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    await notificationWorkpool.enqueueMutation(
      ctx,
      internal.notifications.mutations.applyNotificationPreferencesUpdate,
      {
        createDefaults: {
          disabledTypes: [],
          emailDigest: args.emailDigest,
          emailEnabled: args.emailEnabled,
        },
        patch: {
          emailDigest: args.emailDigest,
          emailEnabled: args.emailEnabled,
        },
        userId: user.appUser._id,
      }
    );

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
    const user = await requireAuth(ctx);

    await notificationWorkpool.enqueueMutation(
      ctx,
      internal.notifications.mutations.applyNotificationPreferencesUpdate,
      {
        createDefaults: {
          disabledTypes: args.disabledTypes,
          emailDigest: "weekly",
          emailEnabled: true,
        },
        patch: {
          disabledTypes: args.disabledTypes,
        },
        userId: user.appUser._id,
      }
    );

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
    const user = await requireAuth(ctx);
    await notificationWorkpool.enqueueMutation(
      ctx,
      internal.notifications.mutations.applyNotificationEntityMuteUpdate,
      {
        entityId: args.entityId,
        entityType: args.entityType,
        muted: args.muted,
        userId: user.appUser._id,
      }
    );

    return null;
  },
});
