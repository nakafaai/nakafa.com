import { internal } from "@repo/backend/convex/_generated/api";
import type { DataModel, Id } from "@repo/backend/convex/_generated/dataModel";
import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import type { GenericMutationCtx } from "convex/server";
import { v } from "convex/values";

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

type CleanupCtx = GenericMutationCtx<DataModel>;
type CleanupEntityType =
  | "schoolClasses"
  | "schoolClassForums"
  | "schoolClassForumPosts";
type CleanupEntityId =
  | Id<"schoolClasses">
  | Id<"schoolClassForums">
  | Id<"schoolClassForumPosts">;

/** Deletes all notifications for one entity in bounded batches. */
async function deleteEntityNotifications(
  ctx: CleanupCtx,
  entityType: CleanupEntityType,
  entityId: CleanupEntityId
) {
  const notifications = await ctx.db
    .query("notifications")
    .withIndex("by_entityType_and_entityId", (q) =>
      q.eq("entityType", entityType).eq("entityId", entityId)
    )
    .take(ENTITY_NOTIFICATION_CLEANUP_BATCH_SIZE);

  for (const notification of notifications) {
    await ctx.db.delete("notifications", notification._id);
  }

  return notifications.length;
}

/** Deletes all muted-entity rows for one entity in bounded batches. */
async function deleteEntityMutes(
  ctx: CleanupCtx,
  entityType: CleanupEntityType,
  entityId: CleanupEntityId
) {
  const mutes = await ctx.db
    .query("notificationEntityMutes")
    .withIndex("by_entityType_and_entityId", (q) =>
      q.eq("entityType", entityType).eq("entityId", entityId)
    )
    .take(ENTITY_MUTE_CLEANUP_BATCH_SIZE);

  for (const mute of mutes) {
    await ctx.db.delete("notificationEntityMutes", mute._id);
  }

  return mutes.length;
}

/** Deletes the remaining class-owned rows after one class document is removed. */
export const cleanupDeletedClass = internalMutation({
  args: {
    classId: vv.id("schoolClasses"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const classMembers = await ctx.db
      .query("schoolClassMembers")
      .withIndex("by_classId_and_userId", (q) => q.eq("classId", args.classId))
      .take(SCHOOL_CLASS_MEMBER_CLEANUP_BATCH_SIZE);

    for (const member of classMembers) {
      await ctx.db.delete("schoolClassMembers", member._id);
    }

    if (classMembers.length === SCHOOL_CLASS_MEMBER_CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        0,
        internal.triggers.schools.cleanup.cleanupDeletedClass,
        args
      );

      return null;
    }

    const inviteCodes = await ctx.db
      .query("schoolClassInviteCodes")
      .withIndex("by_classId_and_role", (q) => q.eq("classId", args.classId))
      .take(SCHOOL_CLASS_INVITE_CODE_CLEANUP_BATCH_SIZE);

    for (const inviteCode of inviteCodes) {
      await ctx.db.delete("schoolClassInviteCodes", inviteCode._id);
    }

    if (inviteCodes.length === SCHOOL_CLASS_INVITE_CODE_CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        0,
        internal.triggers.schools.cleanup.cleanupDeletedClass,
        args
      );

      return null;
    }

    if (
      (await deleteEntityNotifications(ctx, "schoolClasses", args.classId)) ===
      ENTITY_NOTIFICATION_CLEANUP_BATCH_SIZE
    ) {
      await ctx.scheduler.runAfter(
        0,
        internal.triggers.schools.cleanup.cleanupDeletedClass,
        args
      );

      return null;
    }

    if (
      (await deleteEntityMutes(ctx, "schoolClasses", args.classId)) ===
      ENTITY_MUTE_CLEANUP_BATCH_SIZE
    ) {
      await ctx.scheduler.runAfter(
        0,
        internal.triggers.schools.cleanup.cleanupDeletedClass,
        args
      );

      return null;
    }

    const forums = await ctx.db
      .query("schoolClassForums")
      .withIndex("by_classId_and_lastPostAt", (q) =>
        q.eq("classId", args.classId)
      )
      .take(SCHOOL_CLASS_FORUM_CLEANUP_BATCH_SIZE);

    for (const forum of forums) {
      await ctx.scheduler.runAfter(
        0,
        internal.triggers.schools.cleanup.cleanupDeletedForum,
        { forumId: forum._id }
      );
      await ctx.db.delete("schoolClassForums", forum._id);
    }

    if (forums.length === SCHOOL_CLASS_FORUM_CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        0,
        internal.triggers.schools.cleanup.cleanupDeletedClass,
        args
      );

      return null;
    }

    const materialGroups = await ctx.db
      .query("schoolClassMaterialGroups")
      .withIndex("by_classId_and_parentId_and_order", (q) =>
        q.eq("classId", args.classId)
      )
      .take(SCHOOL_CLASS_MATERIAL_GROUP_CLEANUP_BATCH_SIZE);

    for (const group of materialGroups) {
      await ctx.db.delete("schoolClassMaterialGroups", group._id);
    }

    if (
      materialGroups.length === SCHOOL_CLASS_MATERIAL_GROUP_CLEANUP_BATCH_SIZE
    ) {
      await ctx.scheduler.runAfter(
        0,
        internal.triggers.schools.cleanup.cleanupDeletedClass,
        args
      );
    }

    return null;
  },
});

/** Deletes the remaining forum-owned rows after one forum document is removed. */
export const cleanupDeletedForum = internalMutation({
  args: {
    forumId: vv.id("schoolClassForums"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (
      (await deleteEntityNotifications(
        ctx,
        "schoolClassForums",
        args.forumId
      )) === ENTITY_NOTIFICATION_CLEANUP_BATCH_SIZE
    ) {
      await ctx.scheduler.runAfter(
        0,
        internal.triggers.schools.cleanup.cleanupDeletedForum,
        args
      );

      return null;
    }

    if (
      (await deleteEntityMutes(ctx, "schoolClassForums", args.forumId)) ===
      ENTITY_MUTE_CLEANUP_BATCH_SIZE
    ) {
      await ctx.scheduler.runAfter(
        0,
        internal.triggers.schools.cleanup.cleanupDeletedForum,
        args
      );

      return null;
    }

    const forumReactions = await ctx.db
      .query("schoolClassForumReactions")
      .withIndex("by_forumId_and_emoji_and_userId", (q) =>
        q.eq("forumId", args.forumId)
      )
      .take(FORUM_REACTION_CLEANUP_BATCH_SIZE);

    for (const reaction of forumReactions) {
      await ctx.db.delete("schoolClassForumReactions", reaction._id);
    }

    if (forumReactions.length === FORUM_REACTION_CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        0,
        internal.triggers.schools.cleanup.cleanupDeletedForum,
        args
      );

      return null;
    }

    const pendingUploads = await ctx.db
      .query("schoolClassForumPendingUploads")
      .withIndex("by_forumId_and_uploadedBy", (q) =>
        q.eq("forumId", args.forumId)
      )
      .take(FORUM_PENDING_UPLOAD_CLEANUP_BATCH_SIZE);

    for (const upload of pendingUploads) {
      if (upload.storageId) {
        await ctx.storage.delete(upload.storageId);
      }

      await ctx.db.delete("schoolClassForumPendingUploads", upload._id);
    }

    if (pendingUploads.length === FORUM_PENDING_UPLOAD_CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        0,
        internal.triggers.schools.cleanup.cleanupDeletedForum,
        args
      );

      return null;
    }

    const readStates = await ctx.db
      .query("schoolClassForumReadStates")
      .withIndex("by_forumId_and_userId", (q) => q.eq("forumId", args.forumId))
      .take(FORUM_READ_STATE_CLEANUP_BATCH_SIZE);

    for (const readState of readStates) {
      await ctx.db.delete("schoolClassForumReadStates", readState._id);
    }

    if (readStates.length === FORUM_READ_STATE_CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        0,
        internal.triggers.schools.cleanup.cleanupDeletedForum,
        args
      );

      return null;
    }

    const posts = await ctx.db
      .query("schoolClassForumPosts")
      .withIndex("by_forumId", (q) => q.eq("forumId", args.forumId))
      .take(FORUM_POST_CLEANUP_BATCH_SIZE);

    for (const post of posts) {
      await ctx.scheduler.runAfter(
        0,
        internal.triggers.schools.cleanup.cleanupDeletedForumPost,
        { postId: post._id }
      );
      await ctx.db.delete("schoolClassForumPosts", post._id);
    }

    if (posts.length === FORUM_POST_CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        0,
        internal.triggers.schools.cleanup.cleanupDeletedForum,
        args
      );
    }

    return null;
  },
});

/** Deletes the remaining post-owned rows after one forum post is removed. */
export const cleanupDeletedForumPost = internalMutation({
  args: {
    postId: vv.id("schoolClassForumPosts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (
      (await deleteEntityNotifications(
        ctx,
        "schoolClassForumPosts",
        args.postId
      )) === ENTITY_NOTIFICATION_CLEANUP_BATCH_SIZE
    ) {
      await ctx.scheduler.runAfter(
        0,
        internal.triggers.schools.cleanup.cleanupDeletedForumPost,
        args
      );

      return null;
    }

    if (
      (await deleteEntityMutes(ctx, "schoolClassForumPosts", args.postId)) ===
      ENTITY_MUTE_CLEANUP_BATCH_SIZE
    ) {
      await ctx.scheduler.runAfter(
        0,
        internal.triggers.schools.cleanup.cleanupDeletedForumPost,
        args
      );

      return null;
    }

    const attachments = await ctx.db
      .query("schoolClassForumPostAttachments")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .take(FORUM_POST_ATTACHMENT_CLEANUP_BATCH_SIZE);

    for (const attachment of attachments) {
      await ctx.storage.delete(attachment.fileId);
      await ctx.db.delete("schoolClassForumPostAttachments", attachment._id);
    }

    if (attachments.length === FORUM_POST_ATTACHMENT_CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        0,
        internal.triggers.schools.cleanup.cleanupDeletedForumPost,
        args
      );

      return null;
    }

    const reactions = await ctx.db
      .query("schoolClassForumPostReactions")
      .withIndex("by_postId_and_emoji_and_userId", (q) =>
        q.eq("postId", args.postId)
      )
      .take(FORUM_POST_REACTION_CLEANUP_BATCH_SIZE);

    for (const reaction of reactions) {
      await ctx.db.delete("schoolClassForumPostReactions", reaction._id);
    }

    if (reactions.length === FORUM_POST_REACTION_CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        0,
        internal.triggers.schools.cleanup.cleanupDeletedForumPost,
        args
      );
    }

    return null;
  },
});
