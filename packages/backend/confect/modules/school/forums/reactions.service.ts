import type { Id } from "@repo/backend/confect/_generated/dataModel";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { getUserMap } from "@repo/backend/confect/modules/school/classAccess.service";
import { ClassActionError } from "@repo/backend/confect/modules/school/classErrors";
import type {
  SchoolClassForumPosts,
  SchoolClassForums,
} from "@repo/backend/confect/modules/school/classes.tables";
import {
  FORUM_REACTION_PREVIEW_BATCH_LIMIT,
  FORUM_REACTION_PREVIEW_LIMIT,
  MAX_FORUM_REACTION_VALUE_LENGTH,
} from "@repo/backend/confect/modules/school/forums/constants";
import { Effect, type Schema } from "effect";

type ForumDoc = Schema.Schema.Type<typeof SchoolClassForums.Doc>;
type ForumPostDoc = Schema.Schema.Type<typeof SchoolClassForumPosts.Doc>;
type ForumReactionCounts = ForumDoc["reactionCounts"];

const FORUM_REACTION_VALUE_PATTERN =
  /^(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|(?:\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F))(?:\u200D(?:\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*$/u;

/** Validates and returns a forum emoji reaction. */
export function validateForumReactionValue(emoji: string) {
  if (
    emoji.length > 0 &&
    emoji.length <= MAX_FORUM_REACTION_VALUE_LENGTH &&
    FORUM_REACTION_VALUE_PATTERN.test(emoji)
  ) {
    return Effect.succeed(emoji);
  }

  return Effect.fail(
    new ClassActionError({
      message: "Forum reaction must be a supported emoji.",
    })
  );
}

/** Returns denormalized reaction counts after one insert/delete. */
export function applyForumReactionDelta(
  reactionCounts: ForumReactionCounts,
  emoji: string,
  delta: number
) {
  const nextReactionCounts = [...reactionCounts];
  const existingIndex = nextReactionCounts.findIndex(
    (reactionCount) => reactionCount.emoji === emoji
  );

  if (existingIndex < 0 && delta <= 0) {
    return nextReactionCounts;
  }

  if (existingIndex < 0) {
    return [...nextReactionCounts, { count: delta, emoji }];
  }

  const nextCount = nextReactionCounts[existingIndex].count + delta;

  if (nextCount <= 0) {
    nextReactionCounts.splice(existingIndex, 1);
    return nextReactionCounts;
  }

  nextReactionCounts[existingIndex] = { count: nextCount, emoji };
  return nextReactionCounts;
}

/** Reads current user's forum reactions grouped by forum id. */
export const getMyForumReactions = Effect.fnUntraced(function* (
  forumIds: readonly Id<"schoolClassForums">[],
  userId: Id<"users">
) {
  const reader = yield* DatabaseReader;
  const entries = yield* Effect.forEach(forumIds, (forumId) =>
    Effect.gen(function* () {
      const reactions = yield* reader
        .table("schoolClassForumReactions")
        .index("by_forumId_and_userId_and_emoji", (query) =>
          query.eq("forumId", forumId).eq("userId", userId)
        )
        .take(FORUM_REACTION_PREVIEW_BATCH_LIMIT);
      return [forumId, reactions.map((reaction) => reaction.emoji)] as const;
    })
  );

  return new Map(entries);
});

/** Reads current user's post reactions grouped by post id. */
export const getMyPostReactions = Effect.fnUntraced(function* (
  postIds: readonly Id<"schoolClassForumPosts">[],
  userId: Id<"users">
) {
  const reader = yield* DatabaseReader;
  const entries = yield* Effect.forEach(postIds, (postId) =>
    Effect.gen(function* () {
      const reactions = yield* reader
        .table("schoolClassForumPostReactions")
        .index("by_postId_and_userId_and_emoji", (query) =>
          query.eq("postId", postId).eq("userId", userId)
        )
        .take(FORUM_REACTION_PREVIEW_BATCH_LIMIT);
      return [postId, reactions.map((reaction) => reaction.emoji)] as const;
    })
  );

  return new Map(entries);
});

/** Builds forum reaction preview names keyed by emoji. */
export const getForumReactionPreviews = Effect.fnUntraced(function* (
  forum: ForumDoc
) {
  const reader = yield* DatabaseReader;
  const reactionsByEmoji = yield* Effect.forEach(
    forum.reactionCounts,
    ({ count, emoji }) =>
      Effect.gen(function* () {
        if (count === 0) {
          return [emoji, []] as const;
        }

        const reactions = yield* reader
          .table("schoolClassForumReactions")
          .index("by_forumId_and_emoji_and_userId", (query) =>
            query.eq("forumId", forum._id).eq("emoji", emoji)
          )
          .take(Math.min(count, FORUM_REACTION_PREVIEW_LIMIT));
        return [emoji, reactions] as const;
      })
  );

  const userMap = yield* getUserMap(
    reactionsByEmoji.flatMap(([, reactions]) =>
      reactions.map((reaction) => reaction.userId)
    )
  );

  return new Map(
    reactionsByEmoji.map(([emoji, reactions]) => [
      emoji,
      reactions.map(
        (reaction) => userMap.get(reaction.userId)?.name ?? "Unknown"
      ),
    ])
  );
});

/** Builds post reaction preview names keyed by post id and emoji. */
export const getPostReactionPreviews = Effect.fnUntraced(function* (
  posts: readonly ForumPostDoc[]
) {
  const reader = yield* DatabaseReader;
  const reactionsByPost = yield* Effect.forEach(posts, (post) =>
    Effect.gen(function* () {
      const reactionsByEmoji = yield* Effect.forEach(
        post.reactionCounts,
        ({ count, emoji }) =>
          Effect.gen(function* () {
            if (count === 0) {
              return [emoji, []] as const;
            }

            const reactions = yield* reader
              .table("schoolClassForumPostReactions")
              .index("by_postId_and_emoji_and_userId", (query) =>
                query.eq("postId", post._id).eq("emoji", emoji)
              )
              .take(Math.min(count, FORUM_REACTION_PREVIEW_LIMIT));
            return [emoji, reactions] as const;
          })
      );

      return [post._id, reactionsByEmoji] as const;
    })
  );

  const userMap = yield* getUserMap(
    reactionsByPost.flatMap(([, reactionsByEmoji]) =>
      reactionsByEmoji.flatMap(([, reactions]) =>
        reactions.map((reaction) => reaction.userId)
      )
    )
  );

  return new Map(
    reactionsByPost.map(([postId, reactionsByEmoji]) => [
      postId,
      new Map(
        reactionsByEmoji.map(([emoji, reactions]) => [
          emoji,
          reactions.map(
            (reaction) => userMap.get(reaction.userId)?.name ?? "Unknown"
          ),
        ])
      ),
    ])
  );
});
