import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  FORUM_REACTION_PREVIEW_BATCH_LIMIT,
  FORUM_REACTION_PREVIEW_LIMIT,
} from "@repo/backend/confect/classes/forums/constants";
import { getUserMap } from "@repo/backend/confect/users/directory";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Effect, pipe } from "effect";
/**
 * Get current user's emoji reactions for multiple posts.
 */
export const getMyPostReactions = Effect.fn(
  "classes.forums.postReactions.getMyPostReactions"
)(function* (postIds: Id<"schoolClassForumPosts">[], userId: Id<"users">) {
  const _reader = yield* DatabaseReader;
  const reactions = yield* Effect.forEach(postIds, (postId) =>
    _reader
      .table("schoolClassForumPostReactions")
      .index("by_postId_and_userId_and_emoji", (q) =>
        q.eq("postId", postId).eq("userId", userId)
      )
      .take(FORUM_REACTION_PREVIEW_BATCH_LIMIT)
      .pipe(Effect.orDie)
  );
  return Arr.map(reactions, (rows) =>
    Arr.map(rows, (reaction) => reaction.emoji)
  );
});

/**
 * Get per-emoji reactor name previews for a batch of forum posts.
 */
export const getPostReactionPreviews = Effect.fn(
  "classes.forums.postReactions.getPostReactionPreviews"
)(function* (posts: Docs["schoolClassForumPosts"][]) {
  const _reader2 = yield* DatabaseReader;
  const reactionsByPost = yield* Effect.forEach(posts, (post) =>
    Effect.forEach(post.reactionCounts, ({ count, emoji }) =>
      _reader2
        .table("schoolClassForumPostReactions")
        .index("by_postId_and_emoji_and_userId", (q) =>
          q.eq("postId", post._id).eq("emoji", emoji)
        )
        .take(Math.min(count, FORUM_REACTION_PREVIEW_LIMIT))
        .pipe(Effect.orDie)
    )
  );
  const userMap = yield* getUserMap(
    pipe(
      reactionsByPost,
      Arr.flatten,
      Arr.flatten,
      Arr.map((reaction) => reaction.userId)
    )
  );
  return Arr.map(posts, (post, postIndex) =>
    Arr.map(post.reactionCounts, ({ count, emoji }, reactionIndex) => ({
      count,
      emoji,
      reactors: Arr.map(
        reactionsByPost[postIndex][reactionIndex],
        (reaction) => userMap.get(reaction.userId)?.name ?? "Unknown"
      ),
    }))
  );
});
