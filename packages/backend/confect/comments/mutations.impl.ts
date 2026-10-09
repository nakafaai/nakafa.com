import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import spec, {
  CommentWriteError,
} from "@repo/backend/confect/comments/mutations.spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { truncateText } from "@repo/backend/confect/utils/text";
import { cleanSlug } from "@repo/utilities/slug";
import { Effect, Layer, Struct } from "effect";

/**
 * Vote action validator: -1 = downvote, 0 = remove vote, 1 = upvote
 */
const addComment = FunctionImpl.make(
  databaseSchema,
  spec,
  "addComment",
  Effect.fn("comments.mutations.addComment")(function* (args) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const user = yield* requireAuth();
    const cleanedSlug = cleanSlug(args.slug);
    const parentId = args.parentId;
    const parentComment = parentId
      ? yield* database
          .table("comments")
          .get(parentId)
          .pipe(
            Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
            Effect.orDie
          )
      : null;
    if (args.parentId && !parentComment) {
      return yield* new CommentWriteError({
        code: "COMMENT_PARENT_NOT_FOUND",
        message: "Reply parent not found.",
      });
    }
    if (parentComment && parentComment.slug !== cleanedSlug) {
      return yield* new CommentWriteError({
        code: "COMMENT_PARENT_MISMATCH",
        message: "Reply parent must belong to the same slug.",
      });
    }

    // Insert comment - trigger handles parent's replyCount update
    const newCommentId = yield* writer
      .table("comments")
      .insert({
        slug: cleanedSlug,
        userId: user.appUser._id,
        text: args.text,
        ...Struct.pick(args, ["parentId"]),
        ...(parentComment?.userId === undefined
          ? {}
          : {
              replyToUserId: parentComment?.userId,
            }),
        // Store preview snippet (truncated, like Discord)
        ...(parentComment
          ? {
              replyToText: truncateText({
                text: parentComment.text,
              }),
            }
          : {}),
        upvoteCount: 0,
        downvoteCount: 0,
        replyCount: 0,
      })
      .pipe(Effect.orDie);
    return newCommentId;
  })
);
const voteOnComment = FunctionImpl.make(
  databaseSchema,
  spec,
  "voteOnComment",
  Effect.fn("comments.mutations.voteOnComment")(function* (args) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const user = yield* requireAuth();
    const comment = yield* database
      .table("comments")
      .get(args.commentId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!comment) {
      return yield* new CommentWriteError({
        code: "COMMENT_NOT_FOUND",
        message: "Comment not found.",
      });
    }
    const existingVote = yield* database
      .table("commentVotes")
      .get("by_commentId_and_userId", args.commentId, user.appUser._id)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );

    // Remove existing vote if any - trigger handles count update
    if (existingVote) {
      yield* writer.table("commentVotes").delete(existingVote._id);
    }

    // Add new vote if not removing (vote=0 means remove) - trigger handles count update
    const vote = args.vote;
    if (vote === 1 || vote === -1) {
      yield* writer
        .table("commentVotes")
        .insert({
          commentId: args.commentId,
          userId: user.appUser._id,
          vote,
        })
        .pipe(Effect.orDie);
    }
    return null;
  })
);
const deleteComment = FunctionImpl.make(
  databaseSchema,
  spec,
  "deleteComment",
  Effect.fn("comments.mutations.deleteComment")(function* (args) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const user = yield* requireAuth();
    const comment = yield* database
      .table("comments")
      .get(args.commentId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!comment) {
      return yield* new CommentWriteError({
        code: "COMMENT_NOT_FOUND",
        message: `Comment not found for commentId: ${args.commentId}`,
      });
    }
    if (comment.userId !== user.appUser._id) {
      return yield* new CommentWriteError({
        code: "FORBIDDEN",
        message: "You can only delete your own comments.",
      });
    }
    yield* writer.table("comments").delete(args.commentId);
    return null;
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(addComment),
  Layer.provide(voteOnComment),
  Layer.provide(deleteComment),
  Layer.provide(atomic),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
