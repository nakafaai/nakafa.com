import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import { type QueryCtx, query } from "@repo/backend/convex/_generated/server";
import { loadForumWithAccess } from "@repo/backend/convex/classes/forums/utils/access";
import { enrichForumPosts } from "@repo/backend/convex/classes/forums/utils/posts";
import { forumFeedPostValidator } from "@repo/backend/convex/classes/forums/validators";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

async function getForumReadState(
  ctx: QueryCtx,
  forumId: Id<"schoolClassForums">,
  currentUserId: Id<"users">
) {
  return await ctx.db
    .query("schoolClassForumReadStates")
    .withIndex("by_forumId_and_userId", (q) =>
      q.eq("forumId", forumId).eq("userId", currentUserId)
    )
    .unique();
}

/**
 * Enriches the live transcript once per query, keeping unread state
 * server-derived instead of rebuilding that logic on the client.
 *
 * References:
 * - https://docs.convex.dev/understanding/best-practices/
 * - https://docs.convex.dev/database/pagination
 */
async function createForumFeedPosts(
  ctx: QueryCtx,
  {
    currentUserId,
    forumId,
    posts,
  }: {
    currentUserId: Id<"users">;
    forumId: Id<"schoolClassForums">;
    posts: Doc<"schoolClassForumPosts">[];
  }
) {
  const [enrichedPosts, readState] = await Promise.all([
    enrichForumPosts(ctx, posts, currentUserId),
    getForumReadState(ctx, forumId, currentUserId),
  ]);
  const lastReadSequence = readState?.lastReadSequence ?? 0;

  return enrichedPosts.map((post) => ({
    ...post,
    isUnread:
      post.createdBy !== currentUserId && post.sequence > lastReadSequence,
  }));
}

/**
 * Returns the whole forum transcript in ascending sequence order.
 *
 * This is intentionally the simplest possible Convex-first contract for the
 * current rewrite: one reactive query, one ordered array, no client window
 * stitching, and no anchor query.
 *
 * References:
 * - https://docs.convex.dev/understanding/best-practices/
 * - https://stack.convex.dev/fully-reactive-pagination
 */
export const getForumPosts = query({
  args: {
    forumId: vv.id("schoolClassForums"),
  },
  returns: v.array(forumFeedPostValidator),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const currentUserId = user.appUser._id;

    await loadForumWithAccess(ctx, args.forumId, currentUserId);

    const posts = await ctx.db
      .query("schoolClassForumPosts")
      .withIndex("by_forumId_and_sequence", (q) =>
        q.eq("forumId", args.forumId)
      )
      .order("asc")
      .collect();

    return await createForumFeedPosts(ctx, {
      currentUserId,
      forumId: args.forumId,
      posts,
    });
  },
});
