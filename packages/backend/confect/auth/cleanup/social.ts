import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import { dropRestores } from "@repo/backend/confect/nina/memory/restore/store";
import { deleteBatch } from "@repo/backend/confect/nina/memory/store";
import { dropPortrait } from "@repo/backend/confect/nina/portrait/store";
import { POST_LIKE_CLEANUP_BATCH_SIZE } from "@repo/backend/confect/posts/cleanup";
import {
  removeLike,
  removePostLikeBatch,
} from "@repo/backend/confect/posts/likes";
import { findPost } from "@repo/backend/confect/posts/rows";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect, flow, Option } from "effect";

const COMMENT_VOTE_BATCH_SIZE = 50;
const COMMENT_REFERENCE_BATCH_SIZE = 25;

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

/**
 * Removes one bounded batch of the learner's own likes on posts, and takes each
 * one off the count of the post it was on, so the counts of other learners'
 * posts stay exact.
 */
const cleanupPostLikes = Effect.fn("auth.cleanup.cleanupPostLikes")(
  function* (userId: Id<"users">) {
    const database = yield* DatabaseReader;
    const likes = yield* database
      .table("postLikes")
      .index("by_userId", (query) => query.eq("userId", userId))
      .take(POST_LIKE_CLEANUP_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const like of likes) {
      const post = yield* findPost(like.postId);
      yield* removeLike(like, post);
    }
    return likes.length > 0;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/**
 * Removes one bounded batch of the learner's posts. A post goes only after the
 * likes of it that other learners left, so each pass takes one batch of them,
 * and the post itself goes on the pass that finds none left.
 */
const cleanupPosts = Effect.fn("auth.cleanup.cleanupPosts")(
  function* (userId: Id<"users">) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const post = yield* database
      .table("posts")
      .index("by_authorId", (query) => query.eq("authorId", userId))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (!post) {
      return false;
    }
    if ((yield* removePostLikeBatch(post._id)) > 0) {
      return true;
    }
    yield* writer.table("posts").delete(post._id);
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

/**
 * Deletes one bounded batch of the learner's Nina memories, with their key
 * rows, the learner's portrait, and the records that keep a deleted memory for
 * the restore window. A capture that lands during the deletion writes a memory
 * and asks for a portrait, and the next pass deletes both.
 */
const cleanupNinaMemory = Effect.fn("auth.cleanup.ninaMemory")(
  function* (userId: Id<"users">) {
    const deleted = yield* deleteBatch(userId);
    const droppedPortrait = yield* dropPortrait(userId);
    const droppedRestores = yield* dropRestores(userId);
    return deleted > 0 || droppedPortrait || droppedRestores;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Deletes one bounded batch of user-authored social and saved content. */
export const cleanupUserSocialData = Effect.fn(
  "auth.cleanup.cleanupUserSocialData"
)(function* (userId: Id<"users">) {
  if (yield* cleanupComments(userId)) {
    return true;
  }
  if (yield* cleanupPostLikes(userId)) {
    return true;
  }
  if (yield* cleanupPosts(userId)) {
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
