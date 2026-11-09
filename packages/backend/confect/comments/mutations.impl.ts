import { FunctionImpl, GroupImpl } from "@confect/server";
import type { Id } from "@repo/backend/confect/_generated/id";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { CommentWriteError } from "@repo/backend/confect/comments/errors";
import {
  addCommentLike,
  takeBackCommentLike,
} from "@repo/backend/confect/comments/likes";
import spec from "@repo/backend/confect/comments/mutations.spec";
import { postComment } from "@repo/backend/confect/comments/post";
import { spendCommentWrite } from "@repo/backend/confect/comments/rate";
import { findComment } from "@repo/backend/confect/comments/rows";
import {
  readCommentText,
  TEXT_REFUSAL_MESSAGE,
} from "@repo/backend/confect/comments/text";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Clock, Effect, Layer, Result } from "effect";

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

/** The comment with this id, when the learner wrote it. Another learner's comment is refused. */
const readOwnComment = Effect.fn("comments.mutations.readOwnComment")(
  function* (commentId: Id<"comments">, userId: Id<"users">) {
    const comment = yield* readComment(commentId);
    if (comment.userId !== userId) {
      return yield* new CommentWriteError({
        code: "FORBIDDEN",
        message: "You can only change your own comments.",
      });
    }
    return comment;
  }
);

const addComment = FunctionImpl.make(
  databaseSchema,
  spec,
  "addComment",
  Effect.fn("comments.mutations.addComment")(function* (args) {
    const user = yield* requireAuth();
    yield* spendCommentWrite("commentWrite", user.appUser._id);
    return yield* postComment(user.appUser._id, args);
  })
);

/** Changes the Markdown of a learner's own comment, and marks when. Its photos stay as they were posted. */
const editComment = FunctionImpl.make(
  databaseSchema,
  spec,
  "editComment",
  Effect.fn("comments.mutations.editComment")(function* (args) {
    const user = yield* requireAuth();
    const comment = yield* readOwnComment(args.commentId, user.appUser._id);
    const text = readCommentText(args.text, comment.photos?.length ?? 0);
    if (Result.isFailure(text)) {
      return yield* new CommentWriteError({
        code: text.failure,
        message: TEXT_REFUSAL_MESSAGE,
      });
    }
    if (text.success === comment.text) {
      return null;
    }
    yield* spendCommentWrite("commentWrite", user.appUser._id);
    yield* (yield* DatabaseWriter)
      .table("comments")
      .patch(comment._id, {
        editedAt: yield* Clock.currentTimeMillis,
        text: text.success,
      })
      .pipe(Effect.orDie);
    return null;
  })
);

const likeComment = FunctionImpl.make(
  databaseSchema,
  spec,
  "likeComment",
  Effect.fn("comments.mutations.likeComment")(function* (args) {
    const user = yield* requireAuth();
    const comment = yield* readComment(args.commentId);
    yield* spendCommentWrite("commentLike", user.appUser._id);
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
    yield* spendCommentWrite("commentLike", user.appUser._id);
    yield* takeBackCommentLike(comment, user.appUser._id);
    return null;
  })
);

/**
 * Reports another learner's comment, once per learner: a second report of the same comment changes
 * nothing. A learner cannot report their own comment, which they edit or delete instead.
 */
const reportComment = FunctionImpl.make(
  databaseSchema,
  spec,
  "reportComment",
  Effect.fn("comments.mutations.reportComment")(function* (args) {
    const user = yield* requireAuth();
    const comment = yield* readComment(args.commentId);
    if (comment.userId === user.appUser._id) {
      return yield* new CommentWriteError({
        code: "FORBIDDEN",
        message: "You cannot report your own comment.",
      });
    }
    const existing = yield* (yield* DatabaseReader)
      .table("commentReports")
      .get("by_commentId_and_userId", comment._id, user.appUser._id)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (existing !== null) {
      return null;
    }
    yield* spendCommentWrite("commentReport", user.appUser._id);
    yield* (yield* DatabaseWriter)
      .table("commentReports")
      .insert({
        commentId: comment._id,
        createdAt: yield* Clock.currentTimeMillis,
        reason: args.reason,
        userId: user.appUser._id,
      })
      .pipe(Effect.orDie);
    return null;
  })
);

/**
 * Deletes a learner's own comment. The trigger deletes its photos, and its cleanup removes its likes and
 * reports, and its replies with it when it is top-level.
 */
const deleteComment = FunctionImpl.make(
  databaseSchema,
  spec,
  "deleteComment",
  Effect.fn("comments.mutations.deleteComment")(function* (args) {
    const user = yield* requireAuth();
    const comment = yield* readOwnComment(args.commentId, user.appUser._id);
    yield* (yield* DatabaseWriter).table("comments").delete(comment._id);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(addComment),
  Layer.provide(editComment),
  Layer.provide(likeComment),
  Layer.provide(unlikeComment),
  Layer.provide(reportComment),
  Layer.provide(deleteComment),
  Layer.provide(atomic),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
