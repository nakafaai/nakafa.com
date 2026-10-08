import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  FORUM_REACTION_PREVIEW_BATCH_LIMIT,
  FORUM_REACTION_PREVIEW_LIMIT,
  MAX_FORUM_REACTION_VALUE_LENGTH,
} from "@repo/backend/confect/classes/forums/constants";
import { ForumError } from "@repo/backend/confect/classes/forums/spec";
import { getUserMap } from "@repo/backend/confect/users/directory";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Effect, HashMap, Option, pipe } from "effect";

const FORUM_REACTION_VALUE_PATTERN =
  /^(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|(?:\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F))(?:\u200D(?:\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*$/u;

/** Ensure one reaction value is a bounded emoji sequence. */
export const validateForumReactionValue = Effect.fn(
  "classes.forums.reactions.validateForumReactionValue"
)(function* (emoji: string) {
  if (
    emoji.length > 0 &&
    emoji.length <= MAX_FORUM_REACTION_VALUE_LENGTH &&
    FORUM_REACTION_VALUE_PATTERN.test(emoji)
  ) {
    return emoji;
  }
  return yield* new ForumError({
    code: "FORUM_REACTION_INVALID",
    message: "Forum reaction must be a supported emoji.",
  });
});

/**
 * Get current user's emoji reactions for multiple forums.
 */
export const getMyForumReactions = Effect.fn(
  "classes.forums.reactions.getMyForumReactions"
)(function* (forumIds: Id<"schoolClassForums">[], userId: Id<"users">) {
  const _reader = yield* DatabaseReader;
  const reactions = yield* Effect.forEach(forumIds, (forumId) =>
    _reader
      .table("schoolClassForumReactions")
      .index("by_forumId_and_userId_and_emoji", (q) =>
        q.eq("forumId", forumId).eq("userId", userId)
      )
      .take(FORUM_REACTION_PREVIEW_BATCH_LIMIT)
      .pipe(Effect.orDie)
  );
  return Arr.map(reactions, (rows) =>
    Arr.map(rows, (reaction) => reaction.emoji)
  );
});

/**
 * Get per-emoji reactor name previews for one forum.
 */
export const getForumReactionPreviews = Effect.fn(
  "classes.forums.reactions.getForumReactionPreviews"
)(function* (forum: Docs["schoolClassForums"]) {
  const _reader2 = yield* DatabaseReader;
  const reactionsByEmoji = yield* Effect.forEach(
    forum.reactionCounts,
    ({ count, emoji }) =>
      _reader2
        .table("schoolClassForumReactions")
        .index("by_forumId_and_emoji_and_userId", (q) =>
          q.eq("forumId", forum._id).eq("emoji", emoji)
        )
        .take(Math.min(count, FORUM_REACTION_PREVIEW_LIMIT))
        .pipe(Effect.orDie)
  );
  const userMap = yield* getUserMap(
    pipe(
      reactionsByEmoji,
      Arr.flatten,
      Arr.map((reaction) => reaction.userId)
    )
  );
  return Arr.map(forum.reactionCounts, ({ emoji, count }, index) => ({
    count,
    emoji,
    reactors: Arr.map(
      reactionsByEmoji[index],
      (reaction) =>
        Option.getOrUndefined(HashMap.get(userMap, reaction.userId))?.name ??
        "Unknown"
    ),
  }));
});
