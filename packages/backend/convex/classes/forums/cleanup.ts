import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { Effect, Schema } from "effect";

const ENTITY_REFERENCE_BATCH_SIZE = 25;
const FORUM_REACTION_BATCH_SIZE = 25;
const FORUM_UPLOAD_BATCH_SIZE = 10;
const FORUM_READ_STATE_BATCH_SIZE = 25;
const POST_ATTACHMENT_BATCH_SIZE = 10;
const POST_REACTION_BATCH_SIZE = 25;
const POST_REPLY_BATCH_SIZE = 25;
const FORUM_CLEANUP_FAILED_CODE = "FORUM_CLEANUP_FAILED";

type ForumEntityId = Id<"schoolClassForums"> | Id<"schoolClassForumPosts">;
type ForumEntityType = "schoolClassForums" | "schoolClassForumPosts";

/** Typed failure for bounded forum-owned data cleanup. */
export class ForumCleanupError extends Schema.TaggedError<ForumCleanupError>()(
  "ForumCleanupError",
  {
    code: Schema.Literal(FORUM_CLEANUP_FAILED_CODE),
    message: Schema.String,
  }
) {}

function toForumCleanupError(error: unknown) {
  return new ForumCleanupError({
    code: FORUM_CLEANUP_FAILED_CODE,
    message: getUnknownErrorMessage(error),
  });
}

function tryForumCleanup<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: toForumCleanupError,
    try: operation,
  });
}

/** Deletes one bounded notification or mute phase for a forum entity. */
const cleanupEntityReferences = Effect.fn(
  "classes.forums.cleanup.cleanupEntityReferences"
)(function* (
  ctx: MutationCtx,
  entityType: ForumEntityType,
  entityId: ForumEntityId
) {
  const notifications = yield* tryForumCleanup(() =>
    ctx.db
      .query("notifications")
      .withIndex("by_entityType_and_entityId", (query) =>
        query.eq("entityType", entityType).eq("entityId", entityId)
      )
      .take(ENTITY_REFERENCE_BATCH_SIZE)
  );

  for (const notification of notifications) {
    yield* tryForumCleanup(() =>
      ctx.db.delete("notifications", notification._id)
    );
  }

  if (notifications.length > 0) {
    return true;
  }

  const mutes = yield* tryForumCleanup(() =>
    ctx.db
      .query("notificationEntityMutes")
      .withIndex("by_entityType_and_entityId", (query) =>
        query.eq("entityType", entityType).eq("entityId", entityId)
      )
      .take(ENTITY_REFERENCE_BATCH_SIZE)
  );

  for (const mute of mutes) {
    yield* tryForumCleanup(() =>
      ctx.db.delete("notificationEntityMutes", mute._id)
    );
  }

  return mutes.length > 0;
});

/** Deletes one bounded dependency phase for one forum post. */
export const cleanupForumPostData = Effect.fn(
  "classes.forums.cleanup.cleanupForumPostData"
)(function* (ctx: MutationCtx, postId: Id<"schoolClassForumPosts">) {
  if (yield* cleanupEntityReferences(ctx, "schoolClassForumPosts", postId)) {
    return true;
  }

  const attachments = yield* tryForumCleanup(() =>
    ctx.db
      .query("schoolClassForumPostAttachments")
      .withIndex("by_postId", (query) => query.eq("postId", postId))
      .take(POST_ATTACHMENT_BATCH_SIZE)
  );

  for (const attachment of attachments) {
    yield* tryForumCleanup(() => ctx.storage.delete(attachment.fileId));
    yield* tryForumCleanup(() =>
      ctx.db.delete("schoolClassForumPostAttachments", attachment._id)
    );
  }

  if (attachments.length > 0) {
    return true;
  }

  const reactions = yield* tryForumCleanup(() =>
    ctx.db
      .query("schoolClassForumPostReactions")
      .withIndex("by_postId_and_emoji_and_userId", (query) =>
        query.eq("postId", postId)
      )
      .take(POST_REACTION_BATCH_SIZE)
  );

  for (const reaction of reactions) {
    yield* tryForumCleanup(() =>
      ctx.db.delete("schoolClassForumPostReactions", reaction._id)
    );
  }

  if (reactions.length > 0) {
    return true;
  }

  const replies = yield* tryForumCleanup(() =>
    ctx.db
      .query("schoolClassForumPosts")
      .withIndex("by_parentId", (query) => query.eq("parentId", postId))
      .take(POST_REPLY_BATCH_SIZE)
  );

  for (const reply of replies) {
    yield* tryForumCleanup(() =>
      ctx.db.patch("schoolClassForumPosts", reply._id, {
        parentId: undefined,
        replyToBody: undefined,
        replyToUserId: undefined,
      })
    );
  }

  if (replies.length > 0) {
    return true;
  }

  yield* tryForumCleanup(() => ctx.db.delete("schoolClassForumPosts", postId));
  return true;
});

/**
 * Deletes one bounded dependency phase for a forum.
 *
 * The forum row stays present until this returns false, so account deletion
 * never reports local cleanup complete while shared dependent rows remain.
 */
export const cleanupForumData = Effect.fn(
  "classes.forums.cleanup.cleanupForumData"
)(function* (ctx: MutationCtx, forumId: Id<"schoolClassForums">) {
  if (yield* cleanupEntityReferences(ctx, "schoolClassForums", forumId)) {
    return true;
  }

  const reactions = yield* tryForumCleanup(() =>
    ctx.db
      .query("schoolClassForumReactions")
      .withIndex("by_forumId_and_emoji_and_userId", (query) =>
        query.eq("forumId", forumId)
      )
      .take(FORUM_REACTION_BATCH_SIZE)
  );

  for (const reaction of reactions) {
    yield* tryForumCleanup(() =>
      ctx.db.delete("schoolClassForumReactions", reaction._id)
    );
  }

  if (reactions.length > 0) {
    return true;
  }

  const pendingUploads = yield* tryForumCleanup(() =>
    ctx.db
      .query("schoolClassForumPendingUploads")
      .withIndex("by_forumId_and_uploadedBy", (query) =>
        query.eq("forumId", forumId)
      )
      .take(FORUM_UPLOAD_BATCH_SIZE)
  );

  for (const upload of pendingUploads) {
    const storageId = upload.storageId;

    if (storageId) {
      yield* tryForumCleanup(() => ctx.storage.delete(storageId));
    }
    yield* tryForumCleanup(() =>
      ctx.db.delete("schoolClassForumPendingUploads", upload._id)
    );
  }

  if (pendingUploads.length > 0) {
    return true;
  }

  const readStates = yield* tryForumCleanup(() =>
    ctx.db
      .query("schoolClassForumReadStates")
      .withIndex("by_forumId_and_userId", (query) =>
        query.eq("forumId", forumId)
      )
      .take(FORUM_READ_STATE_BATCH_SIZE)
  );

  for (const readState of readStates) {
    yield* tryForumCleanup(() =>
      ctx.db.delete("schoolClassForumReadStates", readState._id)
    );
  }

  if (readStates.length > 0) {
    return true;
  }

  const post = yield* tryForumCleanup(() =>
    ctx.db
      .query("schoolClassForumPosts")
      .withIndex("by_forumId", (query) => query.eq("forumId", forumId))
      .first()
  );

  if (!post) {
    return false;
  }

  return yield* cleanupForumPostData(ctx, post._id);
});
