import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import commentsTable from "@repo/backend/confect/_generated/tables/comments";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { LearnerTextRefusal } from "@repo/backend/confect/writing/text";
import { Schema, Struct } from "effect";

/** Expected denial while writing a comment, or a like or vote on it. */
export class CommentWriteError extends Schema.TaggedError<CommentWriteError>()(
  "CommentWriteError",
  {
    code: Schema.Literals([
      ...LearnerTextRefusal.literals,
      "COMMENT_PARENT_NOT_FOUND",
      "COMMENT_PARENT_MISMATCH",
      "COMMENT_NOT_FOUND",
      "FORBIDDEN",
    ]),
    message: Schema.String,
  }
) {}
/**
 * Vote action validator: -1 = downvote, 0 = remove vote, 1 = upvote. Open web
 * builds still send it, and it maps onto likes: 1 likes, 0 and -1 unlike.
 */
const voteActionValidator = Schema.Literals([-1, 0, 1]);

/**
 * Writes the comments of a slug (article, post, etc.), their replies and their likes.
 * The replies count of a top-level comment is kept by the comment trigger.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "addComment",
      args: () =>
        commentsTable.Fields.mapFields(
          Struct.pick(["slug", "text", "parentId"])
        ).fields,
      returns: () => IdSchema("comments"),
      error: () => Schema.Union([AuthFailure, CommentWriteError]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "voteOnComment",
      args: () => ({
        commentId: IdSchema("comments"),
        vote: voteActionValidator,
      }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AuthFailure, CommentWriteError]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "likeComment",
      args: () => ({
        commentId: IdSchema("comments"),
      }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AuthFailure, CommentWriteError]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "unlikeComment",
      args: () => ({
        commentId: IdSchema("comments"),
      }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AuthFailure, CommentWriteError]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "deleteComment",
      args: () => ({
        commentId: IdSchema("comments"),
      }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AuthFailure, CommentWriteError]),
    })
      .middleware(Session)
      .middleware(Atomic)
  );
