import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import commentsTable from "@repo/backend/confect/_generated/tables/comments";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { CommentWriteError } from "@repo/backend/confect/comments/errors";
import { COMMENT_PHOTO_LIMIT } from "@repo/backend/confect/comments/photo";
import { ReportReason } from "@repo/backend/confect/comments/report";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema, Struct } from "effect";

/** The error of every comment write: a missing session, or a denial the learner can be told. */
const writeError = () => Schema.Union([AuthFailure, CommentWriteError]);

/** What a learner posts: the page, the Markdown, the comment it answers, and the photos it carries. */
export const CommentPost = Schema.Struct({
  ...commentsTable.Fields.mapFields(Struct.pick(["slug", "text", "parentId"]))
    .fields,
  // Optional only while the Worker that predates photos still serves pages; it posts text alone.
  uploads: Schema.optionalKey(
    Schema.Array(IdSchema("commentUploads")).check(
      Schema.isMaxLength(COMMENT_PHOTO_LIMIT)
    )
  ),
});

/** The comment one write acts on. */
const commentArgs = () => ({ commentId: IdSchema("comments") });

/**
 * Writes the comments of a slug (article, lesson, etc.), their replies, edits, likes and reports.
 * The replies count of a top-level comment, and the count of a slug, are kept by the comment trigger.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "addComment",
      args: () => CommentPost.fields,
      returns: () => IdSchema("comments"),
      error: writeError,
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "editComment",
      args: () => ({ ...commentArgs(), text: Schema.String }),
      returns: () => Schema.Null,
      error: writeError,
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "likeComment",
      args: commentArgs,
      returns: () => Schema.Null,
      error: writeError,
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "unlikeComment",
      args: commentArgs,
      returns: () => Schema.Null,
      error: writeError,
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "reportComment",
      args: () => ({ ...commentArgs(), reason: ReportReason }),
      returns: () => Schema.Null,
      error: writeError,
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "deleteComment",
      args: commentArgs,
      returns: () => Schema.Null,
      error: writeError,
    })
      .middleware(Session)
      .middleware(Atomic)
  );
