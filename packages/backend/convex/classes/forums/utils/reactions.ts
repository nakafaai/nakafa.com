import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  FORUM_REACTION_PREVIEW_BATCH_LIMIT,
  FORUM_REACTION_PREVIEW_LIMIT,
  MAX_FORUM_REACTION_VALUE_LENGTH,
} from "@repo/backend/convex/classes/forums/utils/constants";
import { getUserMap } from "@repo/backend/convex/lib/helpers/user";
import { ConvexError } from "convex/values";
import { asyncMap } from "convex-helpers";

const FORUM_REACTION_VALUE_PATTERN =
  /^(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|(?:\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F))(?:\u200D(?:\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*$/u;

/** Ensure one reaction value is a bounded emoji sequence. */
export function validateForumReactionValue(emoji: string) {
  if (
    emoji.length > 0 &&
    emoji.length <= MAX_FORUM_REACTION_VALUE_LENGTH &&
    FORUM_REACTION_VALUE_PATTERN.test(emoji)
  ) {
    return emoji;
  }

  throw new ConvexError({
    code: "FORUM_REACTION_INVALID",
    message: "Forum reaction must be a supported emoji.",
  });
}

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
