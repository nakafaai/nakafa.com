import { loadOpenForumWithAccess } from "@repo/backend/convex/classes/forums/utils/access";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuthWithSession } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";

/**
 * Create an upload URL for one new forum post attachment.
 */
export const generateUploadUrl = mutation({
  args: {
    forumId: vv.id("schoolClassForums"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);
    await loadOpenForumWithAccess(ctx, args.forumId, user.appUser._id);

    return await ctx.storage.generateUploadUrl();
  },
});
