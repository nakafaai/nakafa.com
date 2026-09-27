import { DatabaseReader, DatabaseWriter } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import { deleteMessageBatchFromPoint } from "@repo/backend/confect/chats/transcript/write";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect, flow, Option } from "effect";

const BOOKMARK_BATCH_SIZE = 25;
const COLLECTION_BATCH_SIZE = 25;
const COMMENT_VOTE_BATCH_SIZE = 50;
const COMMENT_REFERENCE_BATCH_SIZE = 25;
const CHAT_TRACE_BATCH_SIZE = 50;

/** Deletes one bounded batch of bookmarks and their collections. */
const cleanupBookmarks = Effect.fn("auth.cleanup.cleanupBookmarks")(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const bookmarks = yield* database
      .table("bookmarks")
      .index("by_userId", (query) => query.eq("userId", userId))
      .take(BOOKMARK_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const bookmark of bookmarks) {
      yield* writer.table("bookmarks").delete(bookmark._id);
    }
    if (bookmarks.length > 0) {
      return true;
    }
    const collections = yield* database
      .table("bookmarkCollections")
      .index("by_userId", (query) => query.eq("userId", userId))
      .take(COLLECTION_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const collection of collections) {
      yield* writer.table("bookmarkCollections").delete(collection._id);
    }
    return collections.length > 0;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Deletes one bounded batch of a user's comments and votes. */
const cleanupComments = Effect.fn("auth.cleanup.cleanupComments")(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const votes = yield* database
      .table("commentVotes")
      .index("by_userId", (query) => query.eq("userId", userId))
      .take(COMMENT_VOTE_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const vote of votes) {
      yield* writer.table("commentVotes").delete(vote._id);
    }
    if (votes.length > 0) {
      return true;
    }
    const referencedReplies = yield* database
      .table("comments")
      .index("by_replyToUserId", (query) => query.eq("replyToUserId", userId))
      .take(COMMENT_REFERENCE_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const reply of referencedReplies) {
      yield* writer
        .table("comments")
        .patch(reply._id, {
          replyToText: undefined,
          replyToUserId: undefined,
        })
        .pipe(Effect.orDie);
    }
    if (referencedReplies.length > 0) {
      return true;
    }
    const comment = yield* database
      .table("comments")
      .index("by_userId", (query) => query.eq("userId", userId))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (!comment) {
      return false;
    }
    const commentVotes = yield* database
      .table("commentVotes")
      .index("by_commentId_and_userId", (query) =>
        query.eq("commentId", comment._id)
      )
      .take(COMMENT_VOTE_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const vote of commentVotes) {
      yield* writer.table("commentVotes").delete(vote._id);
    }
    if (commentVotes.length > 0) {
      return true;
    }
    const replies = yield* database
      .table("comments")
      .index("by_parentId", (query) => query.eq("parentId", comment._id))
      .take(COMMENT_REFERENCE_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const reply of replies) {
      yield* writer
        .table("comments")
        .patch(reply._id, {
          parentId: undefined,
          replyToText: undefined,
          replyToUserId: undefined,
        })
        .pipe(Effect.orDie);
    }
    if (replies.length > 0) {
      return true;
    }
    yield* writer.table("comments").delete(comment._id);
    return true;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Deletes one bounded batch of Nina traces, including orphaned chat traces. */
const cleanupChatTraces = Effect.fn("auth.cleanup.cleanupChatTraces")(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const traces = yield* database
      .table("ninaCapabilityTraces")
      .index("by_userId", (query) => query.eq("userId", userId))
      .take(CHAT_TRACE_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const trace of traces) {
      yield* writer.table("ninaCapabilityTraces").delete(trace._id);
    }
    return traces.length > 0;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Deletes one chat and its bounded transcript batches after traces are gone. */
const cleanupChats = Effect.fn("auth.cleanup.cleanupChats")(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const chat = yield* database
      .table("chats")
      .index("by_userId", (query) => query.eq("userId", userId))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (!chat) {
      return false;
    }
    const transcript = yield* deleteMessageBatchFromPoint(chat._id, 0);
    if (transcript.hasMore) {
      return true;
    }
    yield* writer.table("chats").delete(chat._id);
    return true;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

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
