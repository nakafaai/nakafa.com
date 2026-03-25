import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import {
  notificationMutedEntityValidator,
  notificationPreferenceSettingsValidator,
} from "@repo/backend/convex/notifications/schema";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";

/** Returns the current user's notification settings summary. */
export const getNotificationPreferences = query({
  args: {},
  returns: notificationPreferenceSettingsValidator,
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const preferences = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", user.appUser._id))
      .unique();

    return {
      emailEnabled: preferences?.emailEnabled ?? true,
      emailDigest: preferences?.emailDigest ?? "weekly",
      disabledTypes: preferences?.disabledTypes ?? [],
    };
  },
});

/** Returns the current user's muted entities in pages. */
export const listMutedNotificationEntities = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(notificationMutedEntityValidator),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const result = await ctx.db
      .query("notificationEntityMutes")
      .withIndex("by_userId", (q) => q.eq("userId", user.appUser._id))
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.map((row) => ({
        entityId: row.entityId,
        entityType: row.entityType,
        mutedAt: row.mutedAt,
      })),
    };
  },
});
