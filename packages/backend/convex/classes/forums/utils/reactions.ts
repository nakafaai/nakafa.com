import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  FORUM_REACTION_PREVIEW_BATCH_LIMIT,
  FORUM_REACTION_PREVIEW_LIMIT,
} from "@repo/backend/convex/classes/forums/utils/constants";
import { getUserMap } from "@repo/backend/convex/lib/helpers/user";
import { asyncMap } from "convex-helpers";

/**
 * Get current user's emoji reactions for multiple forums.
 */
export async function getMyForumReactions(
  ctx: QueryCtx,
  forumIds: Id<"schoolClassForums">[],
  userId: Id<"users">
): Promise<Map<Id<"schoolClassForums">, string[]>> {
  const reactions = await asyncMap(forumIds, (forumId) =>
    ctx.db
      .query("schoolClassForumReactions")
      .withIndex("by_forumId_and_userId_and_emoji", (q) =>
        q.eq("forumId", forumId).eq("userId", userId)
      )
      .take(FORUM_REACTION_PREVIEW_BATCH_LIMIT)
  );

  return new Map(
    forumIds.map((forumId, index) => [
      forumId,
      reactions[index].map((reaction) => reaction.emoji),
    ])
  );
}

/**
 * Get per-emoji reactor name previews for one forum.
 */
export async function getForumReactionPreviews(
  ctx: QueryCtx,
  forum: Doc<"schoolClassForums">
) {
  const reactionsByEmoji = await asyncMap(
    forum.reactionCounts,
    ({ count, emoji }) => {
      if (count === 0) {
        return Promise.resolve([]);
      }

      return ctx.db
        .query("schoolClassForumReactions")
        .withIndex("by_forumId_and_emoji_and_userId", (q) =>
          q.eq("forumId", forum._id).eq("emoji", emoji)
        )
        .take(Math.min(count, FORUM_REACTION_PREVIEW_LIMIT));
    }
  );

  const userMap = await getUserMap(
    ctx,
    reactionsByEmoji.flat().map((reaction) => reaction.userId)
  );

  return new Map(
    forum.reactionCounts.map(({ emoji }, index) => [
      emoji,
      reactionsByEmoji[index].map(
        (reaction) => userMap.get(reaction.userId)?.name ?? "Unknown"
      ),
    ])
  );
}
