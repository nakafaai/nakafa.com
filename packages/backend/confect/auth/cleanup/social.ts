import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import { findMemory } from "@repo/backend/confect/nina/memory/store";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect, flow, Option } from "effect";

const BOOKMARK_BATCH_SIZE = 25;
const COLLECTION_BATCH_SIZE = 25;
const COMMENT_VOTE_BATCH_SIZE = 50;
const COMMENT_REFERENCE_BATCH_SIZE = 25;

/** Deletes one bounded batch of bookmarks and their collections. */
const cleanupBookmarks = Effect.fn("auth.cleanup.cleanupBookmarks")(
  function* (userId: Id<"users">) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
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
  function* (userId: Id<"users">) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
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

/** Deletes one chat; its trigger owns the Agent journal cascade. */
const cleanupChats = Effect.fn("auth.cleanup.cleanupChats")(
  function* (userId: Id<"users">) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const chat = yield* database
      .table("chats")
      .index("by_userId", (query) => query.eq("userId", userId))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (!chat) {
      return false;
    }
    yield* writer.table("chats").delete(chat._id);
    return true;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Retires this account's upload grants; Agent retains file-reference ownership. */
const cleanupNinaUploads = Effect.fn("auth.cleanup.ninaUploads")(
  function* (userId: Id<"users">) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const uploads = yield* reader
      .table("ninaUploads")
      .index("by_userId_and_expiresAt", (q) => q.eq("userId", userId))
      .take(25)
      .pipe(Effect.orDie);
    for (const upload of uploads) {
      yield* writer.table("ninaUploads").delete(upload._id).pipe(Effect.orDie);
    }
    return uploads.length > 0;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Deletes the learner's Nina memory, which holds facts from their chats. */
const cleanupNinaMemory = Effect.fn("auth.cleanup.ninaMemory")(
  function* (userId: Id<"users">) {
    const memory = yield* findMemory(userId);
    if (!memory) {
      return false;
    }
    yield* (yield* DatabaseWriter)
      .table("ninaMemories")
      .delete(memory._id)
      .pipe(Effect.orDie);
    return true;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Deletes one bounded batch of user-authored social and saved content. */
export const cleanupUserSocialData = Effect.fn(
  "auth.cleanup.cleanupUserSocialData"
)(function* (userId: Id<"users">) {
  if (yield* cleanupBookmarks(userId)) {
    return true;
  }
  if (yield* cleanupComments(userId)) {
    return true;
  }
  if (yield* cleanupNinaUploads(userId)) {
    return true;
  }
  if (yield* cleanupNinaMemory(userId)) {
    return true;
  }
  return yield* cleanupChats(userId);
});
