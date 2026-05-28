import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth.service";
import { cleanSlug } from "@repo/utilities/helper";
import type { PaginationOptions } from "convex/server";
import { Duration, Effect, Option, Schema } from "effect";

const DEFAULT_COMMENT_SNIPPET_LENGTH = 200;

type VoteAction = -1 | 0 | 1;
type PublicCommentUser = Pick<Doc<"users">, "_id" | "image" | "name">;

export class CommentActionError extends Schema.TaggedError<CommentActionError>()(
  "CommentActionError",
  { message: Schema.String }
) {}

/** Truncates a comment body for reply previews. */
function truncateText({
  maxLength = DEFAULT_COMMENT_SNIPPET_LENGTH,
  text,
}: {
  readonly maxLength?: number;
  readonly text: string;
}) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}\u2026`;
}

/** Applies a bounded reply-count delta to a parent comment. */
const updateParentReplyCount = Effect.fn("comments.updateParentReplyCount")(
  function* (parentId: Id<"comments"> | undefined, delta: number) {
    if (!parentId) {
      return null;
    }

    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const parent = yield* reader
      .table("comments")
      .get(parentId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

    if (!parent) {
      return null;
    }

    yield* writer.table("comments").patch(parentId, {
      replyCount: Math.max(parent.replyCount + delta, 0),
    });

    return null;
  }
);

/** Applies a bounded vote-count delta to a comment. */
const updateCommentVoteCount = Effect.fn("comments.updateVoteCount")(function* (
  commentId: Id<"comments">,
  vote: Exclude<VoteAction, 0>,
  delta: number
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const comment = yield* reader
    .table("comments")
    .get(commentId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!comment) {
    return null;
  }

  if (vote === 1) {
    yield* writer.table("comments").patch(commentId, {
      upvoteCount: Math.max(comment.upvoteCount + delta, 0),
    });
    return null;
  }

  yield* writer.table("comments").patch(commentId, {
    downvoteCount: Math.max(comment.downvoteCount + delta, 0),
  });

  return null;
});

/** Reads public user data for a set of user ids. */
const getUserMap = Effect.fn("comments.getUserMap")(function* (
  userIds: readonly Id<"users">[]
) {
  const reader = yield* DatabaseReader;
  const uniqueUserIds = [...new Set(userIds)];
  const entries: [Id<"users">, PublicCommentUser][] = [];

  for (const userId of uniqueUserIds) {
    const user = yield* reader
      .table("users")
      .get(userId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));
    if (!user) {
      continue;
    }

    entries.push([
      userId,
      {
        _id: user._id,
        image: user.image,
        name: user.name,
      },
    ]);
  }

  return new Map(entries);
});

/** Adds a comment or reply to a content slug. */
export const addComment = Effect.fn("comments.addComment")(function* (args: {
  parentId?: Id<"comments">;
  slug: string;
  text: string;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();
  const cleanedSlug = cleanSlug(args.slug);
  const parentId = args.parentId;
  const parentComment = parentId
    ? yield* reader
        .table("comments")
        .get(parentId)
        .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)))
    : null;

  if (args.parentId && !parentComment) {
    return yield* Effect.fail(
      new CommentActionError({ message: "Reply parent not found." })
    );
  }

  if (parentComment && parentComment.slug !== cleanedSlug) {
    return yield* Effect.fail(
      new CommentActionError({
        message: "Reply parent must belong to the same slug.",
      })
    );
  }

  const commentId = yield* writer.table("comments").insert({
    downvoteCount: 0,
    parentId: args.parentId,
    replyCount: 0,
    replyToText: parentComment
      ? truncateText({ text: parentComment.text })
      : undefined,
    replyToUserId: parentComment?.userId,
    slug: cleanedSlug,
    text: args.text,
    upvoteCount: 0,
    userId: user.appUser._id,
  });
  yield* updateParentReplyCount(parentId, 1);

  return commentId;
});

/** Creates, replaces, or removes the current user's vote on a comment. */
export const voteOnComment = Effect.fn("comments.voteOnComment")(
  function* (args: { commentId: Id<"comments">; vote: VoteAction }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const user = yield* requireAppUser();
    const comment = yield* reader
      .table("comments")
      .get(args.commentId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

    if (!comment) {
      return yield* Effect.fail(
        new CommentActionError({ message: "Comment not found." })
      );
    }

    const existingVoteOption = yield* reader
      .table("commentVotes")
      .index("by_commentId_and_userId", (query) =>
        query.eq("commentId", args.commentId).eq("userId", user.appUser._id)
      )
      .first();
    const existingVote = Option.getOrNull(existingVoteOption);

    if (existingVote) {
      yield* writer.table("commentVotes").delete(existingVote._id);
      yield* updateCommentVoteCount(args.commentId, existingVote.vote, -1);
    }

    const vote = args.vote;
    if (vote === 1 || vote === -1) {
      yield* writer.table("commentVotes").insert({
        commentId: args.commentId,
        userId: user.appUser._id,
        vote,
      });
      yield* updateCommentVoteCount(args.commentId, vote, 1);
    }

    return null;
  }
);

/** Deletes one of the current user's comments. */
export const deleteComment = Effect.fn("comments.deleteComment")(
  function* (args: { commentId: Id<"comments"> }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const user = yield* requireAppUser();
    const comment = yield* reader
      .table("comments")
      .get(args.commentId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

    if (!comment) {
      return yield* Effect.fail(
        new CommentActionError({
          message: `Comment not found for commentId: ${args.commentId}`,
        })
      );
    }

    if (comment.userId !== user.appUser._id) {
      return yield* Effect.fail(
        new CommentActionError({
          message: "You can only delete your own comments.",
        })
      );
    }

    const scheduler = yield* Scheduler;

    yield* writer.table("comments").delete(args.commentId);
    yield* scheduler.runAfter(
      Duration.zero,
      refs.internal.triggers.comments.cleanup.cleanupDeletedComment,
      { commentId: args.commentId }
    );
    yield* updateParentReplyCount(comment.parentId, -1);

    return null;
  }
);

/** Lists comments for a content slug with public author data. */
export const getCommentsBySlug = Effect.fn("comments.getBySlug")(
  function* (args: { paginationOpts: PaginationOptions; slug: string }) {
    const reader = yield* DatabaseReader;
    const comments = yield* reader
      .table("comments")
      .index(
        "by_slug",
        (query) => query.eq("slug", cleanSlug(args.slug)),
        "desc"
      )
      .paginate(args.paginationOpts);
    const commentUserIds = comments.page.map((comment) => comment.userId);
    const replyToUserIds = comments.page.flatMap((comment) =>
      comment.replyToUserId ? [comment.replyToUserId] : []
    );
    const userMap = yield* getUserMap(commentUserIds);
    const replyToUserMap = yield* getUserMap(replyToUserIds);

    return {
      ...comments,
      page: comments.page.map((comment) => {
        const user = userMap.get(comment.userId);
        const replyToUser = comment.replyToUserId
          ? replyToUserMap.get(comment.replyToUserId)
          : undefined;

        return {
          ...comment,
          replyToUser: replyToUser
            ? {
                _id: replyToUser._id,
                image: replyToUser.image,
                name: replyToUser.name,
              }
            : null,
          user: user
            ? {
                _id: user._id,
                image: user.image,
                name: user.name,
              }
            : null,
        };
      }),
    };
  }
);

/** Lists comments authored by a user. */
export const getCommentsByUserId = Effect.fn("comments.getByUserId")(
  function* (args: { paginationOpts: PaginationOptions; userId: Id<"users"> }) {
    const reader = yield* DatabaseReader;

    return yield* reader
      .table("comments")
      .index("by_userId", (query) => query.eq("userId", args.userId), "desc")
      .paginate(args.paginationOpts);
  }
);
