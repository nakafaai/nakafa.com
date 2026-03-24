import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  FORUM_REACTION_PREVIEW_BATCH_LIMIT,
  FORUM_REACTION_PREVIEW_LIMIT,
} from "@repo/backend/convex/classes/forums/utils/constants";
import { getUserMap } from "@repo/backend/convex/lib/helpers/user";
import { asyncMap } from "convex-helpers";

/**
 * Get current user's emoji reactions for multiple posts.
 */
export async function getMyPostReactions(
  ctx: QueryCtx,
  postIds: Id<"schoolClassForumPosts">[],
  userId: Id<"users">
): Promise<Map<Id<"schoolClassForumPosts">, string[]>> {
  const reactions = await asyncMap(postIds, (postId) =>
    ctx.db
      .query("schoolClassForumPostReactions")
      .withIndex("postId_userId_emoji", (q) =>
        q.eq("postId", postId).eq("userId", userId)
      )
      .take(FORUM_REACTION_PREVIEW_BATCH_LIMIT)
  );

  return new Map(
    postIds.map((postId, index) => [
      postId,
      reactions[index].map((reaction) => reaction.emoji),
    ])
  );
}

/**
 * Get per-emoji reactor name previews for a batch of forum posts.
 */
export async function getPostReactionPreviews(
  ctx: QueryCtx,
  posts: Doc<"schoolClassForumPosts">[]
) {
  const reactionsByPost = await asyncMap(posts, (post) =>
    asyncMap(post.reactionCounts, ({ count, emoji }) => {
      if (count === 0) {
        return Promise.resolve([]);
      }

      return ctx.db
        .query("schoolClassForumPostReactions")
        .withIndex("by_postId_and_emoji_and_userId", (q) =>
          q.eq("postId", post._id).eq("emoji", emoji)
        )
        .take(Math.min(count, FORUM_REACTION_PREVIEW_LIMIT));
    })
  );

  const userMap = await getUserMap(
    ctx,
    reactionsByPost
      .flat()
      .flat()
      .map((reaction) => reaction.userId)
  );

  return new Map(
    posts.map((post, postIndex) => [
      post._id,
      new Map(
        post.reactionCounts.map(({ emoji }, reactionIndex) => [
          emoji,
          reactionsByPost[postIndex][reactionIndex].map(
            (reaction) => userMap.get(reaction.userId)?.name ?? "Unknown"
          ),
        ])
      ),
    ])
  );
}
