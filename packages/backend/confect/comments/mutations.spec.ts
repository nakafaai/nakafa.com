import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import commentsTable from "@repo/backend/confect/_generated/tables/comments";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema, Struct } from "effect";

/** Expected denial while writing a comment or its vote. */
export class CommentWriteError extends Schema.TaggedError<CommentWriteError>()(
  "CommentWriteError",
  {
    code: Schema.Literals([
      "COMMENT_PARENT_NOT_FOUND",
      "COMMENT_PARENT_MISMATCH",
      "COMMENT_NOT_FOUND",
      "FORBIDDEN",
    ]),
    message: Schema.String,
  }
) {}
/**
 * Vote action validator: -1 = downvote, 0 = remove vote, 1 = upvote
 */
export const voteActionValidator = Schema.Literals([-1, 0, 1]);

/**
 * Add a comment to a slug (article, post, etc.).
 * Note: Denormalized replyCount is updated via trigger in functions.ts
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
