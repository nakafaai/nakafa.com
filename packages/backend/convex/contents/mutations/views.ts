import { internal } from "@repo/backend/convex/_generated/api";
import { getContentAnalyticsPartition } from "@repo/backend/convex/contents/helpers/partitions";
import {
  loadContentRefBySlug,
  upsertContentView,
} from "@repo/backend/convex/contents/helpers/views";
import { mutation } from "@repo/backend/convex/functions";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import {
  contentViewRefValidator,
  localeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { ConvexError, v } from "convex/values";

/**
 * Detects content registry misses so view tracking stays best-effort.
 */
function isContentNotFoundError(error: unknown) {
  if (!(error instanceof ConvexError)) {
    return false;
  }

  const data = error.data;

  if (!(typeof data === "object" && data !== null && "code" in data)) {
    return false;
  }

  return data.code === "CONTENT_NOT_FOUND";
}

/** Records a unique content view per user or device. */
export const recordContentView = mutation({
  args: {
    contentRef: contentViewRefValidator,
    locale: localeValidator,
    deviceId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    isNewView: v.boolean(),
    alreadyViewed: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await getOptionalAppUser(ctx);

    const contentRef = await loadContentRefBySlug(ctx.db, {
      locale: args.locale,
      slug: args.contentRef.slug,
      type: args.contentRef.type,
    }).catch((error) => {
      if (isContentNotFoundError(error)) {
        return null;
      }

      throw error;
    });

    if (!contentRef) {
      return { success: false, isNewView: false, alreadyViewed: false };
    }

    const result = await upsertContentView(ctx.db, contentRef, {
      deviceId: args.deviceId,
      locale: args.locale,
      slug: args.contentRef.slug,
      userId: user?.appUser._id,
    });

    if (result.isNewView) {
      await ctx.scheduler.runAfter(
        0,
        internal.contents.mutations.analytics.scheduleContentAnalyticsPartition,
        {
          partition: getContentAnalyticsPartition(contentRef),
        }
      );
    }

    return result;
  },
});
