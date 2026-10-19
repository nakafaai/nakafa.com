import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import commentsTable from "@repo/backend/confect/_generated/tables/comments";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { LearnerTextRefusal } from "@repo/backend/confect/writing/text";
import { Schema, Struct } from "effect";

/** Expected denial while writing a comment, or a like on it. */
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
