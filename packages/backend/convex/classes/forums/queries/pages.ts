import { query } from "@repo/backend/convex/_generated/server";
import { loadForumWithAccess } from "@repo/backend/convex/classes/forums/utils/access";
import { enrichForumPosts } from "@repo/backend/convex/classes/forums/utils/posts";
import { paginatedForumFeedValidator } from "@repo/backend/convex/classes/forums/validators";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import schema from "@repo/backend/convex/schema";
import { v } from "convex/values";
import { paginator } from "convex-helpers/server/pagination";

const DEFAULT_FORUM_PAGE_SIZE = 25;

/**
 * Get one reactive forum page pinned by cursor boundaries.
 */
export const getForumPostsPage = query({
  args: {
    cursor: v.union(v.string(), v.null()),
    endCursor: v.optional(v.string()),
    forumId: vv.id("schoolClassForums"),
    numItems: v.optional(v.number()),
  },
  returns: paginatedForumFeedValidator,
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const currentUserId = user.appUser._id;
    await loadForumWithAccess(ctx, args.forumId, currentUserId);

    const [postsPage, readState] = await Promise.all([
      paginator(ctx.db, schema)
        .query("schoolClassForumPosts")
        .withIndex("by_forumId_and_sequence", (q) =>
          q.eq("forumId", args.forumId)
        )
        .order("desc")
        .paginate({
          cursor: args.cursor,
          endCursor: args.endCursor,
          numItems: args.numItems ?? DEFAULT_FORUM_PAGE_SIZE,
        }),
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
    const lastReadSequence = readState?.lastReadSequence ?? 0;

    return {
      ...postsPage,
      page: enrichedPosts.map((post) => ({
        ...post,
        isUnread:
          post.createdBy !== currentUserId && post.sequence > lastReadSequence,
      })),
    };
  },
});
