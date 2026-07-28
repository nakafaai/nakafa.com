import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  toUserCleanupError,
  tryUserCleanup,
} from "@repo/backend/convex/auth/cleanup/spec";
import {
  cleanupForumData,
  cleanupForumPostData,
} from "@repo/backend/convex/classes/forums/cleanup";
import { Effect } from "effect";

const REACTION_BATCH_SIZE = 50;
const READ_STATE_BATCH_SIZE = 50;
const UPLOAD_BATCH_SIZE = 10;
const REPLY_REFERENCE_BATCH_SIZE = 25;
const MATERIAL_VIEW_BATCH_SIZE = 50;

/** Deletes one bounded batch of a user's class-forum reactions. */
const cleanupForumReactions = Effect.fn("auth.cleanup.cleanupForumReactions")(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const postReactions = yield* tryUserCleanup(() =>
      ctx.db
        .query("schoolClassForumPostReactions")
        .withIndex("by_userId", (query) => query.eq("userId", userId))
        .take(REACTION_BATCH_SIZE)
    );

    for (const reaction of postReactions) {
      yield* tryUserCleanup(() =>
        ctx.db.delete("schoolClassForumPostReactions", reaction._id)
      );
    }

    if (postReactions.length > 0) {
      return true;
    }

    const forumReactions = yield* tryUserCleanup(() =>
      ctx.db
        .query("schoolClassForumReactions")
        .withIndex("by_userId", (query) => query.eq("userId", userId))
        .take(REACTION_BATCH_SIZE)
    );

    for (const reaction of forumReactions) {
      yield* tryUserCleanup(() =>
        ctx.db.delete("schoolClassForumReactions", reaction._id)
      );
    }

    return forumReactions.length > 0;
  }
);

/** Deletes one bounded batch of class-forum read state and pending uploads. */
const cleanupForumState = Effect.fn("auth.cleanup.cleanupForumState")(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const readStates = yield* tryUserCleanup(() =>
      ctx.db
        .query("schoolClassForumReadStates")
        .withIndex("by_userId", (query) => query.eq("userId", userId))
        .take(READ_STATE_BATCH_SIZE)
    );

    for (const readState of readStates) {
      yield* tryUserCleanup(() =>
        ctx.db.delete("schoolClassForumReadStates", readState._id)
      );
    }

    if (readStates.length > 0) {
      return true;
    }

    const uploads = yield* tryUserCleanup(() =>
      ctx.db
        .query("schoolClassForumPendingUploads")
        .withIndex("by_uploadedBy", (query) => query.eq("uploadedBy", userId))
        .take(UPLOAD_BATCH_SIZE)
    );

    for (const upload of uploads) {
      const storageId = upload.storageId;

      if (storageId) {
        yield* tryUserCleanup(() => ctx.storage.delete(storageId));
      }

      yield* tryUserCleanup(() =>
        ctx.db.delete("schoolClassForumPendingUploads", upload._id)
      );
    }

    return uploads.length > 0;
  }
);

/** Removes reply previews that quote content owned by the deleted user. */
const cleanupForumReplyReferences = Effect.fn(
  "auth.cleanup.cleanupForumReplyReferences"
)(function* (ctx: MutationCtx, userId: Id<"users">) {
  const replies = yield* tryUserCleanup(() =>
    ctx.db
      .query("schoolClassForumPosts")
      .withIndex("by_replyToUserId", (query) =>
        query.eq("replyToUserId", userId)
      )
      .take(REPLY_REFERENCE_BATCH_SIZE)
  );

  for (const reply of replies) {
    yield* tryUserCleanup(() =>
      ctx.db.patch("schoolClassForumPosts", reply._id, {
        replyToBody: undefined,
        replyToUserId: undefined,
      })
    );
  }

  return replies.length > 0;
});

/** Deletes authored forum roots only after every dependent row is gone. */
const cleanupForumRoots = Effect.fn("auth.cleanup.cleanupForumRoots")(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const forum = yield* tryUserCleanup(() =>
      ctx.db
        .query("schoolClassForums")
        .withIndex("by_createdBy", (query) => query.eq("createdBy", userId))
        .first()
    );

    if (!forum) {
      return false;
    }

    const removedDependencies = yield* cleanupForumData(ctx, forum._id).pipe(
      Effect.mapError(toUserCleanupError)
    );

    if (removedDependencies) {
      return true;
    }

    yield* tryUserCleanup(() => ctx.db.delete("schoolClassForums", forum._id));
    return true;
  }
);

/** Deletes one bounded batch of authored forum threads. */
const cleanupForumPosts = Effect.fn("auth.cleanup.cleanupForumPosts")(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const post = yield* tryUserCleanup(() =>
      ctx.db
        .query("schoolClassForumPosts")
        .withIndex("by_createdBy", (query) => query.eq("createdBy", userId))
        .first()
    );

    if (!post) {
      return false;
    }

    return yield* cleanupForumPostData(ctx, post._id).pipe(
      Effect.mapError(toUserCleanupError)
    );
  }
);

/** Deletes one bounded batch of classroom material view history. */
const cleanupMaterialViews = Effect.fn("auth.cleanup.cleanupMaterialViews")(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const views = yield* tryUserCleanup(() =>
      ctx.db
        .query("schoolClassMaterialViews")
        .withIndex("by_userId", (query) => query.eq("userId", userId))
        .take(MATERIAL_VIEW_BATCH_SIZE)
    );

    for (const view of views) {
      yield* tryUserCleanup(() =>
        ctx.db.delete("schoolClassMaterialViews", view._id)
      );
    }

    return views.length > 0;
  }
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

  if (yield* cleanupForumPosts(ctx, userId)) {
    return true;
  }

  return yield* cleanupMaterialViews(ctx, userId);
});
