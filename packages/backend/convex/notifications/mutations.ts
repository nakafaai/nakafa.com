import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { mutation } from "@repo/backend/convex/_generated/server";
import { requireAuthWithSession } from "@repo/backend/convex/lib/helpers/auth";
import {
  emailDigestTypesValidator,
  notificationEntityIdValidator,
  notificationEntityTypesValidator,
  notificationTypesValidator,
} from "@repo/backend/convex/notifications/schema";
import { ConvexError, type Infer, v } from "convex/values";

const NOTIFICATION_ENTITY_MUTE_DUPLICATE_LIMIT = 10;
type NotificationDigest = Infer<typeof emailDigestTypesValidator>;
type NotificationType = Infer<typeof notificationTypesValidator>;

/** Patch or create the current user's notification preferences without clobbering unrelated fields. */
async function upsertNotificationPreferences(
  ctx: MutationCtx,
  {
    createDefaults,
    patch,
    userId,
  }: {
    createDefaults: {
      disabledTypes: NotificationType[];
      emailDigest: NotificationDigest;
      emailEnabled: boolean;
    };
    patch: Partial<{
      disabledTypes: NotificationType[];
      emailDigest: NotificationDigest;
      emailEnabled: boolean;
    }>;
    userId: Id<"users">;
  }
) {
  const preferences = await ctx.db
    .query("notificationPreferences")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  const updatedAt = Date.now();

  if (!preferences) {
    await ctx.db.insert("notificationPreferences", {
      ...createDefaults,
      updatedAt,
      userId,
    });

    return null;
  }

  await ctx.db.patch("notificationPreferences", preferences._id, {
    ...patch,
    updatedAt,
  });

  return null;
}

/** Updates the current user's email notification settings. */
export const updateNotificationPreferences = mutation({
  args: {
    emailDigest: emailDigestTypesValidator,
    emailEnabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);
    return upsertNotificationPreferences(ctx, {
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
    });
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
    return upsertNotificationPreferences(ctx, {
      createDefaults: {
        disabledTypes: args.disabledTypes,
        emailDigest: "weekly",
        emailEnabled: true,
      },
      patch: {
        disabledTypes: args.disabledTypes,
      },
      userId: user.appUser._id,
    });
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
      userId: user.appUser._id,
    });

    return null;
  },
});
