import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import type {
  MutationCtx as ConvexMutationCtx,
  QueryCtx as ConvexQueryCtx,
} from "@repo/backend/confect/_generated/services";
import { getUserMap } from "@repo/backend/confect/modules/school/classAccess.service";
import { ClassActionError } from "@repo/backend/confect/modules/school/classErrors";
import {
  FORUM_REACTION_PREVIEW_BATCH_LIMIT,
  FORUM_REACTION_PREVIEW_LIMIT,
  MAX_FORUM_REACTION_VALUE_LENGTH,
} from "@repo/backend/confect/modules/school/forums/constants";
import { Effect } from "effect";

type DatabaseCtx = ConvexMutationCtx | ConvexQueryCtx;

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

/** Reads current user's forum reactions grouped by forum id. */
export const getMyForumReactions = Effect.fn(
  "school.forums.getMyForumReactions"
)(function* (
  ctx: DatabaseCtx,
  forumIds: readonly Id<"schoolClassForums">[],
  userId: Id<"users">
) {
  const entries = yield* Effect.forEach(forumIds, (forumId) =>
    Effect.gen(function* () {
      const reactions = yield* Effect.promise(() =>
        ctx.db
          .query("schoolClassForumReactions")
          .withIndex("by_forumId_and_userId_and_emoji", (query) =>
            query.eq("forumId", forumId).eq("userId", userId)
          )
          .take(FORUM_REACTION_PREVIEW_BATCH_LIMIT)
      );
      return [forumId, reactions.map((reaction) => reaction.emoji)] as const;
    })
  );

  return new Map(entries);
});

/** Reads current user's post reactions grouped by post id. */
export const getMyPostReactions = Effect.fn("school.forums.getMyPostReactions")(
  function* (
    ctx: DatabaseCtx,
    postIds: readonly Id<"schoolClassForumPosts">[],
    userId: Id<"users">
  ) {
    const entries = yield* Effect.forEach(postIds, (postId) =>
      Effect.gen(function* () {
        const reactions = yield* Effect.promise(() =>
          ctx.db
            .query("schoolClassForumPostReactions")
            .withIndex("by_postId_and_userId_and_emoji", (query) =>
              query.eq("postId", postId).eq("userId", userId)
            )
            .take(FORUM_REACTION_PREVIEW_BATCH_LIMIT)
        );
        return [postId, reactions.map((reaction) => reaction.emoji)] as const;
      })
    );

    return new Map(entries);
  }
);

/** Builds forum reaction preview names keyed by emoji. */
export const getForumReactionPreviews = Effect.fn(
  "school.forums.getForumReactionPreviews"
)(function* (ctx: DatabaseCtx, forum: Doc<"schoolClassForums">) {
  const reactionsByEmoji = yield* Effect.forEach(
    forum.reactionCounts,
    ({ count, emoji }) =>
      Effect.gen(function* () {
        if (count === 0) {
          return [emoji, []] as const;
        }

        const reactions = yield* Effect.promise(() =>
          ctx.db
            .query("schoolClassForumReactions")
            .withIndex("by_forumId_and_emoji_and_userId", (query) =>
              query.eq("forumId", forum._id).eq("emoji", emoji)
            )
            .take(Math.min(count, FORUM_REACTION_PREVIEW_LIMIT))
        );
        return [emoji, reactions] as const;
      })
  );

  const userMap = yield* getUserMap(
    ctx,
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
export const getPostReactionPreviews = Effect.fn(
  "school.forums.getPostReactionPreviews"
)(function* (ctx: DatabaseCtx, posts: readonly Doc<"schoolClassForumPosts">[]) {
  const reactionsByPost = yield* Effect.forEach(posts, (post) =>
    Effect.gen(function* () {
      const reactionsByEmoji = yield* Effect.forEach(
        post.reactionCounts,
        ({ count, emoji }) =>
          Effect.gen(function* () {
            if (count === 0) {
              return [emoji, []] as const;
            }

            const reactions = yield* Effect.promise(() =>
              ctx.db
                .query("schoolClassForumPostReactions")
                .withIndex("by_postId_and_emoji_and_userId", (query) =>
                  query.eq("postId", post._id).eq("emoji", emoji)
                )
                .take(Math.min(count, FORUM_REACTION_PREVIEW_LIMIT))
            );
            return [emoji, reactions] as const;
          })
      );

      return [post._id, reactionsByEmoji] as const;
    })
  );

  const userMap = yield* getUserMap(
    ctx,
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
