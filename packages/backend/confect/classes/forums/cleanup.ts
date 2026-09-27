import { DatabaseReader, DatabaseWriter, StorageWriter } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  FORUM_CLEANUP_FAILED_CODE,
  ForumCleanupError,
} from "@repo/backend/confect/classes/forums/spec";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect, flow, Option } from "effect";

const FORUM_REACTION_BATCH_SIZE = 25;
const FORUM_UPLOAD_BATCH_SIZE = 10;
const FORUM_READ_STATE_BATCH_SIZE = 25;
const POST_ATTACHMENT_BATCH_SIZE = 10;
const POST_REACTION_BATCH_SIZE = 25;
const POST_REPLY_BATCH_SIZE = 25;

/** Typed failure for bounded forum-owned data cleanup. */

function toForumCleanupError(error: unknown) {
  return new ForumCleanupError({
    code: FORUM_CLEANUP_FAILED_CODE,
    message: getUnknownErrorMessage(error),
  });
}
/** Deletes one bounded dependency phase for one forum post. */
export const cleanupForumPostData = Effect.fn(
  "classes.forums.cleanup.cleanupForumPostData"
)(
  function* (ctx: MutationCtx, postId: Id<"schoolClassForumPosts">) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const storage = yield* StorageWriter.StorageWriter.pipe(
      Effect.provide(StorageWriter.StorageWriter.layer(ctx.storage))
    );
    const attachments = yield* database
      .table("schoolClassForumPostAttachments")
      .index("by_postId", (query) => query.eq("postId", postId))
      .take(POST_ATTACHMENT_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const attachment of attachments) {
      yield* storage
        .delete(attachment.fileId)
        .pipe(Effect.mapError(toForumCleanupError));
      yield* writer
        .table("schoolClassForumPostAttachments")
        .delete(attachment._id);
    }
    if (attachments.length > 0) {
      return true;
    }
    const reactions = yield* database
      .table("schoolClassForumPostReactions")
      .index("by_postId_and_emoji_and_userId", (query) =>
        query.eq("postId", postId)
      )
      .take(POST_REACTION_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const reaction of reactions) {
      yield* writer.table("schoolClassForumPostReactions").delete(reaction._id);
    }
    if (reactions.length > 0) {
      return true;
    }
    const replies = yield* database
      .table("schoolClassForumPosts")
      .index("by_parentId", (query) => query.eq("parentId", postId))
      .take(POST_REPLY_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const reply of replies) {
      yield* writer
        .table("schoolClassForumPosts")
        .patch(reply._id, {
          parentId: undefined,
          replyToBody: undefined,
          replyToUserId: undefined,
        })
        .pipe(Effect.orDie);
    }
    if (replies.length > 0) {
      return true;
    }
    yield* writer.table("schoolClassForumPosts").delete(postId);
    return true;
  },
  Effect.catchDefect(flow(toForumCleanupError, Effect.fail))
);

/**
 * Deletes one bounded dependency phase for a forum.
 *
 * The forum row stays present until this returns false, so account deletion
 * never reports local cleanup complete while shared dependent rows remain.
 */
export const cleanupForumData = Effect.fn(
  "classes.forums.cleanup.cleanupForumData"
)(
  function* (ctx: MutationCtx, forumId: Id<"schoolClassForums">) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const storage = yield* StorageWriter.StorageWriter.pipe(
      Effect.provide(StorageWriter.StorageWriter.layer(ctx.storage))
    );
    const reactions = yield* database
      .table("schoolClassForumReactions")
      .index("by_forumId_and_emoji_and_userId", (query) =>
        query.eq("forumId", forumId)
      )
      .take(FORUM_REACTION_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const reaction of reactions) {
      yield* writer.table("schoolClassForumReactions").delete(reaction._id);
    }
    if (reactions.length > 0) {
      return true;
    }
    const pendingUploads = yield* database
      .table("schoolClassForumPendingUploads")
      .index("by_forumId_and_uploadedBy", (query) =>
        query.eq("forumId", forumId)
      )
      .take(FORUM_UPLOAD_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const upload of pendingUploads) {
      const storageId = upload.storageId;
      if (storageId) {
        yield* storage
          .delete(storageId)
          .pipe(Effect.mapError(toForumCleanupError));
      }
      yield* writer.table("schoolClassForumPendingUploads").delete(upload._id);
    }
    if (pendingUploads.length > 0) {
      return true;
    }
    const readStates = yield* database
      .table("schoolClassForumReadStates")
      .index("by_forumId_and_userId", (query) => query.eq("forumId", forumId))
      .take(FORUM_READ_STATE_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const readState of readStates) {
      yield* writer.table("schoolClassForumReadStates").delete(readState._id);
    }
    if (readStates.length > 0) {
      return true;
    }
    const post = yield* database
      .table("schoolClassForumPosts")
      .index("by_forumId_and_sequence", (query) => query.eq("forumId", forumId))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (!post) {
      return false;
    }
    return yield* cleanupForumPostData(ctx, post._id);
  },
  Effect.catchDefect(flow(toForumCleanupError, Effect.fail))
);
