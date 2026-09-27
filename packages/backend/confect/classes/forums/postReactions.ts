import { DatabaseReader } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  FORUM_REACTION_PREVIEW_BATCH_LIMIT,
  FORUM_REACTION_PREVIEW_LIMIT,
} from "@repo/backend/confect/classes/forums/constants";
import { getUserMap } from "@repo/backend/confect/users/directory";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";
/**
 * Get current user's emoji reactions for multiple posts.
 */
export const getMyPostReactions = Effect.fn(
  "classes.forums.postReactions.getMyPostReactions"
)(function* (
  ctx: QueryCtx,
  postIds: Id<"schoolClassForumPosts">[],
  userId: Id<"users">
) {
  const reactions = yield* Effect.forEach(postIds, (postId) =>
    DatabaseReader.make(databaseSchema, ctx.db)
      .table("schoolClassForumPostReactions")
      .index("by_postId_and_userId_and_emoji", (q) =>
        q.eq("postId", postId).eq("userId", userId)
      )
      .take(FORUM_REACTION_PREVIEW_BATCH_LIMIT)
      .pipe(Effect.orDie)
  );
  return reactions.map((rows) => rows.map((reaction) => reaction.emoji));
});

/**
 * Get per-emoji reactor name previews for a batch of forum posts.
 */
export const getPostReactionPreviews = Effect.fn(
  "classes.forums.postReactions.getPostReactionPreviews"
)(function* (ctx: QueryCtx, posts: Doc<"schoolClassForumPosts">[]) {
  const reactionsByPost = yield* Effect.forEach(posts, (post) =>
    Effect.forEach(post.reactionCounts, ({ count, emoji }) =>
      DatabaseReader.make(databaseSchema, ctx.db)
        .table("schoolClassForumPostReactions")
        .index("by_postId_and_emoji_and_userId", (q) =>
          q.eq("postId", post._id).eq("emoji", emoji)
        )
        .take(Math.min(count, FORUM_REACTION_PREVIEW_LIMIT))
        .pipe(Effect.orDie)
    )
  );
  const userMap = yield* getUserMap(
    ctx,
    reactionsByPost
      .flat()
      .flat()
      .map((reaction) => reaction.userId)
  );
  return posts.map((post, postIndex) =>
    post.reactionCounts.map(({ count, emoji }, reactionIndex) => ({
      count,
      emoji,
      reactors: reactionsByPost[postIndex][reactionIndex].map(
        (reaction) => userMap.get(reaction.userId)?.name ?? "Unknown"
      ),
    }))
  );
});
