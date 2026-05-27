import { Ref } from "@confect/core";
import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Effect } from "effect";

const SCHOOL_CLASS_MEMBER_CLEANUP_BATCH_SIZE = 100;
const SCHOOL_CLASS_INVITE_CODE_CLEANUP_BATCH_SIZE = 100;
const SCHOOL_CLASS_FORUM_CLEANUP_BATCH_SIZE = 25;
const SCHOOL_CLASS_MATERIAL_GROUP_CLEANUP_BATCH_SIZE = 25;
const ENTITY_NOTIFICATION_CLEANUP_BATCH_SIZE = 100;
const ENTITY_MUTE_CLEANUP_BATCH_SIZE = 100;
const FORUM_REACTION_CLEANUP_BATCH_SIZE = 100;
const FORUM_PENDING_UPLOAD_CLEANUP_BATCH_SIZE = 25;
const FORUM_READ_STATE_CLEANUP_BATCH_SIZE = 100;
const FORUM_POST_CLEANUP_BATCH_SIZE = 50;
const FORUM_POST_ATTACHMENT_CLEANUP_BATCH_SIZE = 25;
const FORUM_POST_REACTION_CLEANUP_BATCH_SIZE = 100;

type SchoolCleanupEntity =
  | "schoolClasses"
  | "schoolClassForums"
  | "schoolClassForumPosts";

/** Schedules another deleted class cleanup batch. */
function rescheduleDeletedClass(
  ctx: MutationCtx,
  args: { classId: Id<"schoolClasses"> }
) {
  return ctx.scheduler.runAfter(
    0,
    Ref.getFunctionReference(
      refs.internal.triggers.schools.cleanup.cleanupDeletedClass
    ),
    args
  );
}

/** Schedules another deleted forum cleanup batch. */
function rescheduleDeletedForum(
  ctx: MutationCtx,
  args: { forumId: Id<"schoolClassForums"> }
) {
  return ctx.scheduler.runAfter(
    0,
    Ref.getFunctionReference(
      refs.internal.triggers.schools.cleanup.cleanupDeletedForum
    ),
    args
  );
}

/** Schedules another deleted forum post cleanup batch. */
function rescheduleDeletedForumPost(
  ctx: MutationCtx,
  args: { postId: Id<"schoolClassForumPosts"> }
) {
  return ctx.scheduler.runAfter(
    0,
    Ref.getFunctionReference(
      refs.internal.triggers.schools.cleanup.cleanupDeletedForumPost
    ),
    args
  );
}

/** Deletes notification rows for one deleted entity batch. */
async function deleteEntityNotifications(
  ctx: MutationCtx,
  entityType: SchoolCleanupEntity,
  entityId:
    | Id<"schoolClasses">
    | Id<"schoolClassForums">
    | Id<"schoolClassForumPosts">
) {
  const notifications = await ctx.db
    .query("notifications")
    .withIndex("by_entityType_and_entityId", (query) =>
      query.eq("entityType", entityType).eq("entityId", entityId)
    )
    .take(ENTITY_NOTIFICATION_CLEANUP_BATCH_SIZE);

  for (const notification of notifications) {
    await ctx.db.delete(notification._id);
  }

  return notifications.length;
}

/** Deletes notification mute rows for one deleted entity batch. */
async function deleteEntityMutes(
  ctx: MutationCtx,
  entityType: SchoolCleanupEntity,
  entityId:
    | Id<"schoolClasses">
    | Id<"schoolClassForums">
    | Id<"schoolClassForumPosts">
) {
  const mutes = await ctx.db
    .query("notificationEntityMutes")
    .withIndex("by_entityType_and_entityId", (query) =>
      query.eq("entityType", entityType).eq("entityId", entityId)
    )
    .take(ENTITY_MUTE_CLEANUP_BATCH_SIZE);

  for (const mute of mutes) {
    await ctx.db.delete(mute._id);
  }

  return mutes.length;
}

/** Removes dependent rows after a class row has been deleted. */
export const cleanupDeletedClass = Effect.fn(
  "schoolCleanup.cleanupDeletedClass"
)(function* (args: { classId: Id<"schoolClasses"> }) {
  const ctx = yield* MutationCtx;
  const classMembers = yield* Effect.promise(() =>
    ctx.db
      .query("schoolClassMembers")
      .withIndex("by_classId_and_userId", (query) =>
        query.eq("classId", args.classId)
      )
      .take(SCHOOL_CLASS_MEMBER_CLEANUP_BATCH_SIZE)
  );

  for (const member of classMembers) {
    yield* Effect.promise(() => ctx.db.delete(member._id));
  }

  if (classMembers.length === SCHOOL_CLASS_MEMBER_CLEANUP_BATCH_SIZE) {
    yield* Effect.promise(() => rescheduleDeletedClass(ctx, args));
    return null;
  }

  const inviteCodes = yield* Effect.promise(() =>
    ctx.db
      .query("schoolClassInviteCodes")
      .withIndex("by_classId_and_role", (query) =>
        query.eq("classId", args.classId)
      )
      .take(SCHOOL_CLASS_INVITE_CODE_CLEANUP_BATCH_SIZE)
  );

  for (const inviteCode of inviteCodes) {
    yield* Effect.promise(() => ctx.db.delete(inviteCode._id));
  }

  if (
    inviteCodes.length === SCHOOL_CLASS_INVITE_CODE_CLEANUP_BATCH_SIZE ||
    (yield* Effect.promise(() =>
      deleteEntityNotifications(ctx, "schoolClasses", args.classId)
    )) === ENTITY_NOTIFICATION_CLEANUP_BATCH_SIZE ||
    (yield* Effect.promise(() =>
      deleteEntityMutes(ctx, "schoolClasses", args.classId)
    )) === ENTITY_MUTE_CLEANUP_BATCH_SIZE
  ) {
    yield* Effect.promise(() => rescheduleDeletedClass(ctx, args));
    return null;
  }

  const forums = yield* Effect.promise(() =>
    ctx.db
      .query("schoolClassForums")
      .withIndex("by_classId_and_lastPostAt", (query) =>
        query.eq("classId", args.classId)
      )
      .take(SCHOOL_CLASS_FORUM_CLEANUP_BATCH_SIZE)
  );

  for (const forum of forums) {
    yield* Effect.promise(() =>
      ctx.scheduler.runAfter(
        0,
        Ref.getFunctionReference(
          refs.internal.triggers.schools.cleanup.cleanupDeletedForum
        ),
        { forumId: forum._id }
      )
    );
    yield* Effect.promise(() => ctx.db.delete(forum._id));
  }

  if (forums.length === SCHOOL_CLASS_FORUM_CLEANUP_BATCH_SIZE) {
    yield* Effect.promise(() => rescheduleDeletedClass(ctx, args));
    return null;
  }

  const materialGroups = yield* Effect.promise(() =>
    ctx.db
      .query("schoolClassMaterialGroups")
      .withIndex("by_classId_and_parentId_and_order", (query) =>
        query.eq("classId", args.classId)
      )
      .take(SCHOOL_CLASS_MATERIAL_GROUP_CLEANUP_BATCH_SIZE)
  );

  for (const group of materialGroups) {
    yield* Effect.promise(() => ctx.db.delete(group._id));
  }

  if (
    materialGroups.length === SCHOOL_CLASS_MATERIAL_GROUP_CLEANUP_BATCH_SIZE
  ) {
    yield* Effect.promise(() => rescheduleDeletedClass(ctx, args));
  }

  return null;
});

/** Removes dependent rows after a forum row has been deleted. */
export const cleanupDeletedForum = Effect.fn(
  "schoolCleanup.cleanupDeletedForum"
)(function* (args: { forumId: Id<"schoolClassForums"> }) {
  const ctx = yield* MutationCtx;

  if (
    (yield* Effect.promise(() =>
      deleteEntityNotifications(ctx, "schoolClassForums", args.forumId)
    )) === ENTITY_NOTIFICATION_CLEANUP_BATCH_SIZE ||
    (yield* Effect.promise(() =>
      deleteEntityMutes(ctx, "schoolClassForums", args.forumId)
    )) === ENTITY_MUTE_CLEANUP_BATCH_SIZE
  ) {
    yield* Effect.promise(() => rescheduleDeletedForum(ctx, args));
    return null;
  }

  const forumReactions = yield* Effect.promise(() =>
    ctx.db
      .query("schoolClassForumReactions")
      .withIndex("by_forumId_and_emoji_and_userId", (query) =>
        query.eq("forumId", args.forumId)
      )
      .take(FORUM_REACTION_CLEANUP_BATCH_SIZE)
  );

  for (const reaction of forumReactions) {
    yield* Effect.promise(() => ctx.db.delete(reaction._id));
  }

  if (forumReactions.length === FORUM_REACTION_CLEANUP_BATCH_SIZE) {
    yield* Effect.promise(() => rescheduleDeletedForum(ctx, args));
    return null;
  }

  const pendingUploads = yield* Effect.promise(() =>
    ctx.db
      .query("schoolClassForumPendingUploads")
      .withIndex("by_forumId_and_uploadedBy", (query) =>
        query.eq("forumId", args.forumId)
      )
      .take(FORUM_PENDING_UPLOAD_CLEANUP_BATCH_SIZE)
  );

  for (const upload of pendingUploads) {
    if (upload.storageId) {
      const storageId = upload.storageId;
      yield* Effect.promise(() => ctx.storage.delete(storageId));
    }
    yield* Effect.promise(() => ctx.db.delete(upload._id));
  }

  if (pendingUploads.length === FORUM_PENDING_UPLOAD_CLEANUP_BATCH_SIZE) {
    yield* Effect.promise(() => rescheduleDeletedForum(ctx, args));
    return null;
  }

  const readStates = yield* Effect.promise(() =>
    ctx.db
      .query("schoolClassForumReadStates")
      .withIndex("by_forumId_and_userId", (query) =>
        query.eq("forumId", args.forumId)
      )
      .take(FORUM_READ_STATE_CLEANUP_BATCH_SIZE)
  );

  for (const readState of readStates) {
    yield* Effect.promise(() => ctx.db.delete(readState._id));
  }

  if (readStates.length === FORUM_READ_STATE_CLEANUP_BATCH_SIZE) {
    yield* Effect.promise(() => rescheduleDeletedForum(ctx, args));
    return null;
  }

  const posts = yield* Effect.promise(() =>
    ctx.db
      .query("schoolClassForumPosts")
      .withIndex("by_forumId", (query) => query.eq("forumId", args.forumId))
      .take(FORUM_POST_CLEANUP_BATCH_SIZE)
  );

  for (const post of posts) {
    yield* Effect.promise(() =>
      ctx.scheduler.runAfter(
        0,
        Ref.getFunctionReference(
          refs.internal.triggers.schools.cleanup.cleanupDeletedForumPost
        ),
        { postId: post._id }
      )
    );
    yield* Effect.promise(() => ctx.db.delete(post._id));
  }

  if (posts.length === FORUM_POST_CLEANUP_BATCH_SIZE) {
    yield* Effect.promise(() => rescheduleDeletedForum(ctx, args));
  }

  return null;
});

/** Removes dependent rows after a forum post row has been deleted. */
export const cleanupDeletedForumPost = Effect.fn(
  "schoolCleanup.cleanupDeletedForumPost"
)(function* (args: { postId: Id<"schoolClassForumPosts"> }) {
  const ctx = yield* MutationCtx;

  if (
    (yield* Effect.promise(() =>
      deleteEntityNotifications(ctx, "schoolClassForumPosts", args.postId)
    )) === ENTITY_NOTIFICATION_CLEANUP_BATCH_SIZE ||
    (yield* Effect.promise(() =>
      deleteEntityMutes(ctx, "schoolClassForumPosts", args.postId)
    )) === ENTITY_MUTE_CLEANUP_BATCH_SIZE
  ) {
    yield* Effect.promise(() => rescheduleDeletedForumPost(ctx, args));
    return null;
  }

  const attachments = yield* Effect.promise(() =>
    ctx.db
      .query("schoolClassForumPostAttachments")
      .withIndex("by_postId", (query) => query.eq("postId", args.postId))
      .take(FORUM_POST_ATTACHMENT_CLEANUP_BATCH_SIZE)
  );

  for (const attachment of attachments) {
    yield* Effect.promise(() => ctx.storage.delete(attachment.fileId));
    yield* Effect.promise(() => ctx.db.delete(attachment._id));
  }

  if (attachments.length === FORUM_POST_ATTACHMENT_CLEANUP_BATCH_SIZE) {
    yield* Effect.promise(() => rescheduleDeletedForumPost(ctx, args));
    return null;
  }

  const reactions = yield* Effect.promise(() =>
    ctx.db
      .query("schoolClassForumPostReactions")
      .withIndex("by_postId_and_emoji_and_userId", (query) =>
        query.eq("postId", args.postId)
      )
      .take(FORUM_POST_REACTION_CLEANUP_BATCH_SIZE)
  );

  for (const reaction of reactions) {
    yield* Effect.promise(() => ctx.db.delete(reaction._id));
  }

  if (reactions.length === FORUM_POST_REACTION_CLEANUP_BATCH_SIZE) {
    yield* Effect.promise(() => rescheduleDeletedForumPost(ctx, args));
  }

  return null;
});
