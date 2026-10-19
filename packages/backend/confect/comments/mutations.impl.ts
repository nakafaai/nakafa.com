import { FunctionImpl, GroupImpl } from "@confect/server";
import type { Id } from "@repo/backend/confect/_generated/id";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import {
  addCommentLike,
  takeBackCommentLike,
} from "@repo/backend/confect/comments/likes";
import spec, {
  CommentWriteError,
} from "@repo/backend/confect/comments/mutations.spec";
import { findComment } from "@repo/backend/confect/comments/rows";
import { threadOf } from "@repo/backend/confect/comments/thread";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import {
  LEARNER_TEXT_MAX_LENGTH,
  readLearnerText,
} from "@repo/backend/confect/writing/text";
import { cleanSlug } from "@repo/utilities/slug";
import { Effect, Layer, Result } from "effect";

/** The comment with this id. A missing comment gives the same answer to every learner. */
const readComment = Effect.fn("comments.mutations.readComment")(function* (
  commentId: Id<"comments">
) {
  const comment = yield* findComment(commentId);
  if (comment === null) {
    return yield* new CommentWriteError({
      code: "COMMENT_NOT_FOUND",
      message: "Comment not found.",
    });
  }
  return comment;
});

/**
 * Adds a top-level comment or a reply. A reply names its parent and the top-level
 * comment of its thread, so every reply, also a reply to a reply, sits in one thread.
 */
const addComment = FunctionImpl.make(
  databaseSchema,
  spec,
  "addComment",
  Effect.fn("comments.mutations.addComment")(function* (args) {
    const writer = yield* DatabaseWriter;
    const user = yield* requireAuth();
    const text = readLearnerText(args.text);
    if (Result.isFailure(text)) {
      return yield* new CommentWriteError({
        code: text.failure,
        message: `The comment must hold 1 to ${LEARNER_TEXT_MAX_LENGTH} characters.`,
      });
    }
    const cleanedSlug = cleanSlug(args.slug);
    const parentId = args.parentId;
    const parentComment =
      parentId === undefined ? null : yield* findComment(parentId);
    if (parentId !== undefined && parentComment === null) {
      return yield* new CommentWriteError({
        code: "COMMENT_PARENT_NOT_FOUND",
        message: "Reply parent not found.",
      });
    }
    if (parentComment !== null && parentComment.slug !== cleanedSlug) {
      return yield* new CommentWriteError({
        code: "COMMENT_PARENT_MISMATCH",
        message: "Reply parent must belong to the same slug.",
      });
    }
    // The trigger keeps the reply count of the thread's top-level comment.
    return yield* writer
      .table("comments")
      .insert({
        slug: cleanedSlug,
        userId: user.appUser._id,
        text: text.success,
        ...(parentComment === null
          ? {}
          : {
              parentId: parentComment._id,
              replyToUserId: parentComment.userId,
              threadId: yield* threadOf(parentComment),
            }),
        likeCount: 0,
        replyCount: 0,
      })
      .pipe(Effect.orDie);
  })
);

const likeComment = FunctionImpl.make(
  databaseSchema,
  spec,
  "likeComment",
  Effect.fn("comments.mutations.likeComment")(function* (args) {
    const user = yield* requireAuth();
    const comment = yield* readComment(args.commentId);
    yield* addCommentLike(comment, user.appUser._id);
    return null;
  })
);

const unlikeComment = FunctionImpl.make(
  databaseSchema,
  spec,
  "unlikeComment",
  Effect.fn("comments.mutations.unlikeComment")(function* (args) {
    const user = yield* requireAuth();
    const comment = yield* readComment(args.commentId);
    yield* takeBackCommentLike(comment, user.appUser._id);
    return null;
  })
);

/**
 * Deletes a learner's own comment. The trigger's cleanup removes its likes, and its
 * replies with it when it is top-level.
 */
const deleteComment = FunctionImpl.make(
  databaseSchema,
  spec,
  "deleteComment",
  Effect.fn("comments.mutations.deleteComment")(function* (args) {
    const writer = yield* DatabaseWriter;
    const user = yield* requireAuth();
    const comment = yield* findComment(args.commentId);
    if (comment === null) {
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
  Layer.provide(likeComment),
  Layer.provide(unlikeComment),
  Layer.provide(deleteComment),
  Layer.provide(atomic),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
