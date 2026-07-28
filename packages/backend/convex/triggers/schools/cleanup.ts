import { internal } from "@repo/backend/convex/_generated/api";
import type { DataModel, Id } from "@repo/backend/convex/_generated/dataModel";
import { cleanupForumData } from "@repo/backend/convex/classes/forums/cleanup";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import type { GenericMutationCtx } from "convex/server";
import { v } from "convex/values";

const SCHOOL_CLASS_MEMBER_CLEANUP_BATCH_SIZE = 100;
const SCHOOL_CLASS_INVITE_CODE_CLEANUP_BATCH_SIZE = 100;
const SCHOOL_CLASS_FORUM_CLEANUP_BATCH_SIZE = 25;
const SCHOOL_CLASS_MATERIAL_GROUP_CLEANUP_BATCH_SIZE = 25;
const ENTITY_NOTIFICATION_CLEANUP_BATCH_SIZE = 100;
const ENTITY_MUTE_CLEANUP_BATCH_SIZE = 100;

type CleanupCtx = GenericMutationCtx<DataModel>;

/** Deletes all notifications for one entity in bounded batches. */
async function deleteEntityNotifications(
  ctx: CleanupCtx,
  entityId: Id<"schoolClasses">
) {
  const notifications = await ctx.db
    .query("notifications")
    .withIndex("by_entityType_and_entityId", (q) =>
      q.eq("entityType", "schoolClasses").eq("entityId", entityId)
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
  entityId: Id<"schoolClasses">
) {
  const mutes = await ctx.db
    .query("notificationEntityMutes")
    .withIndex("by_entityType_and_entityId", (q) =>
      q.eq("entityType", "schoolClasses").eq("entityId", entityId)
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
      (await deleteEntityNotifications(ctx, args.classId)) ===
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
      (await deleteEntityMutes(ctx, args.classId)) ===
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

/** Drains forum-owned rows after one forum document is removed. */
export const cleanupDeletedForum = internalMutation({
  args: {
    forumId: vv.id("schoolClassForums"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (await runConvexProgram(cleanupForumData(ctx, args.forumId))) {
      await ctx.scheduler.runAfter(
        0,
        internal.triggers.schools.cleanup.cleanupDeletedForum,
        args
      );
    }

    return null;
  },
});
