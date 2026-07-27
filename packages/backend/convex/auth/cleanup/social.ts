import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { tryUserCleanup } from "@repo/backend/convex/auth/cleanup/spec";
import { deleteMessageBatchFromPoint } from "@repo/backend/convex/chats/helpers";
import { Effect } from "effect";

const BOOKMARK_BATCH_SIZE = 25;
const COLLECTION_BATCH_SIZE = 25;
const COMMENT_VOTE_BATCH_SIZE = 50;
const COMMENT_REFERENCE_BATCH_SIZE = 25;
const COMMENT_DEPENDENCY_BATCH_SIZE = 25;
const CHAT_TRACE_BATCH_SIZE = 50;

/** Deletes one bounded batch of bookmarks and their collections. */
const cleanupBookmarks = Effect.fn("auth.cleanup.cleanupBookmarks")(function* (
  ctx: MutationCtx,
  userId: Id<"users">
) {
  const bookmarks = yield* tryUserCleanup(() =>
    ctx.db
      .query("bookmarks")
      .withIndex("by_userId", (query) => query.eq("userId", userId))
      .take(BOOKMARK_BATCH_SIZE)
  );

  for (const bookmark of bookmarks) {
    yield* tryUserCleanup(() => ctx.db.delete("bookmarks", bookmark._id));
  }

  if (bookmarks.length === BOOKMARK_BATCH_SIZE) {
    return true;
  }

  const collections = yield* tryUserCleanup(() =>
    ctx.db
      .query("bookmarkCollections")
      .withIndex("by_userId", (query) => query.eq("userId", userId))
      .take(COLLECTION_BATCH_SIZE)
  );

  for (const collection of collections) {
    yield* tryUserCleanup(() =>
      ctx.db.delete("bookmarkCollections", collection._id)
    );
  }

  return collections.length === COLLECTION_BATCH_SIZE;
});

/** Deletes one bounded batch of a user's comments and votes. */
const cleanupComments = Effect.fn("auth.cleanup.cleanupComments")(function* (
  ctx: MutationCtx,
  userId: Id<"users">
) {
  const votes = yield* tryUserCleanup(() =>
    ctx.db
      .query("commentVotes")
      .withIndex("by_userId", (query) => query.eq("userId", userId))
      .take(COMMENT_VOTE_BATCH_SIZE)
  );

  for (const vote of votes) {
    yield* tryUserCleanup(() => ctx.db.delete("commentVotes", vote._id));
  }

  if (votes.length === COMMENT_VOTE_BATCH_SIZE) {
    return true;
  }

  const referencedReplies = yield* tryUserCleanup(() =>
    ctx.db
      .query("comments")
      .withIndex("by_replyToUserId", (query) =>
        query.eq("replyToUserId", userId)
      )
      .take(COMMENT_REFERENCE_BATCH_SIZE)
  );

  for (const reply of referencedReplies) {
    yield* tryUserCleanup(() =>
      ctx.db.patch("comments", reply._id, {
        replyToText: undefined,
        replyToUserId: undefined,
      })
    );
  }

  if (referencedReplies.length === COMMENT_REFERENCE_BATCH_SIZE) {
    return true;
  }

  const comment = yield* tryUserCleanup(() =>
    ctx.db
      .query("comments")
      .withIndex("by_userId", (query) => query.eq("userId", userId))
      .first()
  );

  if (!comment) {
    return false;
  }

  const notifications = yield* tryUserCleanup(() =>
    ctx.db
      .query("notifications")
      .withIndex("by_entityType_and_entityId", (query) =>
        query.eq("entityType", "comments").eq("entityId", comment._id)
      )
      .take(COMMENT_DEPENDENCY_BATCH_SIZE)
  );

  for (const notification of notifications) {
    yield* tryUserCleanup(() =>
      ctx.db.delete("notifications", notification._id)
    );
  }

  if (notifications.length === COMMENT_DEPENDENCY_BATCH_SIZE) {
    return true;
  }

  const mutes = yield* tryUserCleanup(() =>
    ctx.db
      .query("notificationEntityMutes")
      .withIndex("by_entityType_and_entityId", (query) =>
        query.eq("entityType", "comments").eq("entityId", comment._id)
      )
      .take(COMMENT_DEPENDENCY_BATCH_SIZE)
  );

  for (const mute of mutes) {
    yield* tryUserCleanup(() =>
      ctx.db.delete("notificationEntityMutes", mute._id)
    );
  }

  if (mutes.length === COMMENT_DEPENDENCY_BATCH_SIZE) {
    return true;
  }

  const commentVotes = yield* tryUserCleanup(() =>
    ctx.db
      .query("commentVotes")
      .withIndex("by_commentId_and_userId", (query) =>
        query.eq("commentId", comment._id)
      )
      .take(COMMENT_VOTE_BATCH_SIZE)
  );

  for (const vote of commentVotes) {
    yield* tryUserCleanup(() => ctx.db.delete("commentVotes", vote._id));
  }

  if (commentVotes.length === COMMENT_VOTE_BATCH_SIZE) {
    return true;
  }

  const replies = yield* tryUserCleanup(() =>
    ctx.db
      .query("comments")
      .withIndex("by_parentId", (query) => query.eq("parentId", comment._id))
      .take(COMMENT_REFERENCE_BATCH_SIZE)
  );

  for (const reply of replies) {
    yield* tryUserCleanup(() =>
      ctx.db.patch("comments", reply._id, {
        parentId: undefined,
        replyToText: undefined,
        replyToUserId: undefined,
      })
    );
  }

  if (replies.length === COMMENT_REFERENCE_BATCH_SIZE) {
    return true;
  }

  yield* tryUserCleanup(() => ctx.db.delete("comments", comment._id));
  return true;
});

/** Deletes one bounded batch of Nina traces, including orphaned chat traces. */
const cleanupChatTraces = Effect.fn("auth.cleanup.cleanupChatTraces")(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const traces = yield* tryUserCleanup(() =>
      ctx.db
        .query("ninaCapabilityTraces")
        .withIndex("by_userId", (query) => query.eq("userId", userId))
        .take(CHAT_TRACE_BATCH_SIZE)
    );

    for (const trace of traces) {
      yield* tryUserCleanup(() =>
        ctx.db.delete("ninaCapabilityTraces", trace._id)
      );
    }

    return traces.length === CHAT_TRACE_BATCH_SIZE;
  }
);

/** Deletes one chat and its bounded transcript batches after traces are gone. */
const cleanupChats = Effect.fn("auth.cleanup.cleanupChats")(function* (
  ctx: MutationCtx,
  userId: Id<"users">
) {
  const chat = yield* tryUserCleanup(() =>
    ctx.db
      .query("chats")
      .withIndex("by_userId", (query) => query.eq("userId", userId))
      .first()
  );

  if (!chat) {
    return false;
  }

  const transcript = yield* tryUserCleanup(() =>
    deleteMessageBatchFromPoint(ctx, chat._id, 0)
  );

  if (transcript.hasMore) {
    return true;
  }

  yield* tryUserCleanup(() => ctx.db.delete("chats", chat._id));
  return true;
});

/** Deletes one bounded batch of user-authored social and saved content. */
export const cleanupUserSocialData = Effect.fn(
  "auth.cleanup.cleanupUserSocialData"
)(function* (ctx: MutationCtx, userId: Id<"users">) {
  if (yield* cleanupBookmarks(ctx, userId)) {
    return true;
  }

  if (yield* cleanupComments(ctx, userId)) {
    return true;
  }

  if (yield* cleanupChatTraces(ctx, userId)) {
    return true;
  }

  return yield* cleanupChats(ctx, userId);
});
