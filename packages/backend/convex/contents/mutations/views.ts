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
import { v } from "convex/values";

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
    });

    return await upsertContentView(ctx.db, contentRef, {
      deviceId: args.deviceId,
      locale: args.locale,
      slug: args.contentRef.slug,
      userId: user?.appUser._id,
    });
  },
});
