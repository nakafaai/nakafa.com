import { query } from "@repo/backend/convex/_generated/server";
import { loadForumWithAccess } from "@repo/backend/convex/classes/forums/utils/access";
import { enrichForumPosts } from "@repo/backend/convex/classes/forums/utils/posts";
import { annotateUnreadForumPosts } from "@repo/backend/convex/classes/forums/utils/readBoundary";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { paginationOptsValidator } from "convex/server";

/**
 * Get the latest forum posts page annotated for the current user.
 */
export const getForumPosts = query({
  args: {
    forumId: vv.id("schoolClassForums"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const currentUserId = user.appUser._id;
    await loadForumWithAccess(ctx, args.forumId, currentUserId);

    const [postsPage, readState] = await Promise.all([
      ctx.db
        .query("schoolClassForumPosts")
        .withIndex("by_forumId", (q) => q.eq("forumId", args.forumId))
        .order("desc")
        .paginate(args.paginationOpts),
      ctx.db
        .query("schoolClassForumReadStates")
        .withIndex("by_forumId_and_userId", (q) =>
          q.eq("forumId", args.forumId).eq("userId", currentUserId)
        )
        .unique(),
    ]);

    const enrichedPosts = await enrichForumPosts(
      ctx,
      postsPage.page,
      currentUserId
    );

    return {
      ...postsPage,
      page: await annotateUnreadForumPosts(ctx.db, {
        currentUserId,
        forumId: args.forumId,
        posts: enrichedPosts,
        readState,
      }),
    };
  },
});
