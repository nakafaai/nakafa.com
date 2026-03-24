import { loadForumWithAccess } from "@repo/backend/convex/classes/forums/utils/access";
import { updateForumReadState } from "@repo/backend/convex/classes/forums/utils/readStateWrite";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuthWithSession } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { ConvexError } from "convex/values";

/**
 * Mark a forum as read through a concrete post boundary.
 */
export const markForumRead = mutation({
  args: {
    forumId: vv.id("schoolClassForums"),
    lastReadPostId: vv.id("schoolClassForumPosts"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);
    const userId = user.appUser._id;
    const { forum } = await loadForumWithAccess(ctx, args.forumId, userId);
    const lastReadPost = await ctx.db.get(
      "schoolClassForumPosts",
      args.lastReadPostId
    );

    if (!lastReadPost || lastReadPost.forumId !== args.forumId) {
      throw new ConvexError({
        code: "POST_NOT_FOUND",
        message: "Read boundary post not found.",
      });
    }

    await updateForumReadState(ctx, {
      classId: forum.classId,
      forumId: args.forumId,
      lastReadAt: Math.min(lastReadPost._creationTime, forum.lastPostAt),
      lastReadPostId: lastReadPost._id,
      userId,
    });
  },
});
