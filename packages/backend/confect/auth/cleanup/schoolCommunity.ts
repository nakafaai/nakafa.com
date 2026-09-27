import { DatabaseReader, DatabaseWriter } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import { deleteForumPendingUpload } from "@repo/backend/confect/classes/forums/attachments/impl";
import {
  cleanupForumData,
  cleanupForumPostData,
} from "@repo/backend/confect/classes/forums/cleanup";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect, flow, Option } from "effect";

const REACTION_BATCH_SIZE = 50;
const READ_STATE_BATCH_SIZE = 50;
const UPLOAD_BATCH_SIZE = 10;
const REPLY_REFERENCE_BATCH_SIZE = 25;

/** Deletes one bounded batch of a user's class-forum reactions. */
const cleanupForumReactions = Effect.fn("auth.cleanup.cleanupForumReactions")(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const postReactions = yield* database
      .table("schoolClassForumPostReactions")
      .index("by_userId", (query) => query.eq("userId", userId))
      .take(REACTION_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const reaction of postReactions) {
      yield* writer.table("schoolClassForumPostReactions").delete(reaction._id);
    }
    if (postReactions.length > 0) {
      return true;
    }
    const forumReactions = yield* database
      .table("schoolClassForumReactions")
      .index("by_userId", (query) => query.eq("userId", userId))
      .take(REACTION_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const reaction of forumReactions) {
      yield* writer.table("schoolClassForumReactions").delete(reaction._id);
    }
    return forumReactions.length > 0;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Deletes one bounded batch of class-forum read state and pending uploads. */
const cleanupForumState = Effect.fn("auth.cleanup.cleanupForumState")(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const readStates = yield* database
      .table("schoolClassForumReadStates")
      .index("by_userId", (query) => query.eq("userId", userId))
      .take(READ_STATE_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const readState of readStates) {
      yield* writer.table("schoolClassForumReadStates").delete(readState._id);
    }
    if (readStates.length > 0) {
      return true;
    }
    const uploads = yield* database
      .table("schoolClassForumPendingUploads")
      .index("by_uploadedBy", (query) => query.eq("uploadedBy", userId))
      .take(UPLOAD_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const upload of uploads) {
      yield* deleteForumPendingUpload(ctx, upload).pipe(
        Effect.mapError(toUserCleanupError)
      );
    }
    return uploads.length > 0;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Removes reply previews that quote content owned by the deleted user. */
const cleanupForumReplyReferences = Effect.fn(
  "auth.cleanup.cleanupForumReplyReferences"
)(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const replies = yield* database
      .table("schoolClassForumPosts")
      .index("by_replyToUserId", (query) => query.eq("replyToUserId", userId))
      .take(REPLY_REFERENCE_BATCH_SIZE);
    for (const reply of replies) {
      yield* writer.table("schoolClassForumPosts").patch(reply._id, {
        replyToBody: undefined,
        replyToUserId: undefined,
      });
    }
    return replies.length > 0;
  },
  Effect.orDie,
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Deletes authored forum roots only after every dependent row is gone. */
const cleanupForumRoots = Effect.fn("auth.cleanup.cleanupForumRoots")(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const forum = yield* database
      .table("schoolClassForums")
      .index("by_createdBy", (query) => query.eq("createdBy", userId))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (!forum) {
      return false;
    }
    const removedDependencies = yield* cleanupForumData(ctx, forum._id).pipe(
      Effect.mapError(toUserCleanupError)
    );
    if (removedDependencies) {
      return true;
    }
    yield* writer.table("schoolClassForums").delete(forum._id);
    return true;
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Deletes one bounded batch of authored forum threads. */
const cleanupForumPosts = Effect.fn("auth.cleanup.cleanupForumPosts")(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const post = yield* database
      .table("schoolClassForumPosts")
      .index("by_createdBy", (query) => query.eq("createdBy", userId))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (!post) {
      return false;
    }
    return yield* cleanupForumPostData(ctx, post._id).pipe(
      Effect.mapError(toUserCleanupError)
    );
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);

/** Deletes one bounded batch of personal school community data. */
export const cleanupUserSchoolCommunity = Effect.fn(
  "auth.cleanup.cleanupUserSchoolCommunity"
)(function* (ctx: MutationCtx, userId: Id<"users">) {
  if (yield* cleanupForumReactions(ctx, userId)) {
    return true;
  }
  if (yield* cleanupForumState(ctx, userId)) {
    return true;
  }
  if (yield* cleanupForumReplyReferences(ctx, userId)) {
    return true;
  }
  if (yield* cleanupForumRoots(ctx, userId)) {
    return true;
  }
  return yield* cleanupForumPosts(ctx, userId);
});
