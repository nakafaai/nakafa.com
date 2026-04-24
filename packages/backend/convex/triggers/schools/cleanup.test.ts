import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 3, 16, 9, 0, 0);

/** Insert one school row with the minimum fields required by the schema. */
async function insertSchool(ctx: MutationCtx, userId: Id<"users">) {
  return await ctx.db.insert("schools", {
    name: "Nakafa School",
    slug: `nakafa-${userId}`,
    email: `${userId}@example.com`,
    city: "Jakarta",
    province: "DKI Jakarta",
    type: "high-school",
    currentStudents: 0,
    currentTeachers: 0,
    updatedAt: NOW,
    createdBy: userId,
    updatedBy: userId,
  });
}

/** Insert one class row with the minimum fields required by the schema. */
async function insertClass(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  userId: Id<"users">
) {
  return await ctx.db.insert("schoolClasses", {
    schoolId,
    name: "Class 10A",
    subject: "Mathematics",
    year: "2026/2027",
    image: "retro",
    isArchived: false,
    visibility: "public",
    studentCount: 0,
    teacherCount: 0,
    updatedAt: NOW,
    createdBy: userId,
    updatedBy: userId,
  });
}

/** Insert one forum row owned by a class. */
async function insertForum(
  ctx: MutationCtx,
  classId: Id<"schoolClasses">,
  schoolId: Id<"schools">,
  userId: Id<"users">
) {
  return await ctx.db.insert("schoolClassForums", {
    classId,
    schoolId,
    title: "Forum",
    body: "Body",
    tag: "general",
    status: "open",
    isPinned: false,
    postCount: 0,
    nextPostSequence: 1,
    reactionCounts: [],
    lastPostAt: NOW,
    lastPostBy: userId,
    createdBy: userId,
    updatedAt: NOW,
  });
}

/** Insert one forum post row owned by a forum. */
async function insertForumPost(
  ctx: MutationCtx,
  classId: Id<"schoolClasses">,
  forumId: Id<"schoolClassForums">,
  userId: Id<"users">
) {
  return await ctx.db.insert("schoolClassForumPosts", {
    forumId,
    classId,
    body: "Post body",
    mentions: [],
    replyCount: 0,
    reactionCounts: [],
    sequence: 1,
    createdBy: userId,
    updatedAt: NOW,
  });
}

/** Insert one unread notification and its current unread count row. */
async function insertUnreadNotification(
  ctx: MutationCtx,
  {
    entityId,
    entityType,
    recipientId,
  }: {
    entityId:
      | Id<"schoolClasses">
      | Id<"schoolClassForums">
      | Id<"schoolClassForumPosts">;
    entityType: "schoolClasses" | "schoolClassForums" | "schoolClassForumPosts";
    recipientId: Id<"users">;
  }
) {
  await ctx.db.insert("notifications", {
    recipientId,
    type: "class_announcement",
    entityType,
    entityId,
    previewTitle: "Preview",
    previewBody: "Preview body",
  });
  await ctx.db.insert("notificationCounts", {
    userId: recipientId,
    unreadCount: 1,
    updatedAt: NOW,
  });
}

describe("triggers/schools/cleanupDeletedClass", () => {
  it("removes top-level rows owned by a deleted class", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    await t.mutation(async (ctx) => {
      const viewer = await seedAuthenticatedUser(ctx, { now: NOW });
      const schoolId = await insertSchool(ctx, viewer.userId);
      const classId = await insertClass(ctx, schoolId, viewer.userId);
      await ctx.db.insert("schoolClassMembers", {
        classId,
        schoolId,
        userId: viewer.userId,
        role: "teacher",
        teacherRole: "primary",
        updatedAt: NOW,
      });
      await ctx.db.insert("schoolClassInviteCodes", {
        classId,
        schoolId,
        role: "student",
        code: "ABC123",
        enabled: true,
        currentUsage: 0,
        createdBy: viewer.userId,
        updatedBy: viewer.userId,
        updatedAt: NOW,
      });
      await insertUnreadNotification(ctx, {
        entityId: classId,
        entityType: "schoolClasses",
        recipientId: viewer.userId,
      });
      await ctx.db.insert("notificationEntityMutes", {
        entityId: classId,
        entityType: "schoolClasses",
        mutedAt: NOW,
        userId: viewer.userId,
      });
      await ctx.runMutation(
        internal.triggers.schools.cleanup.cleanupDeletedClass,
        {
          classId,
        }
      );

      expect(
        await ctx.db
          .query("schoolClassMembers")
          .withIndex("by_classId_and_userId", (q) => q.eq("classId", classId))
          .collect()
      ).toHaveLength(0);
      expect(
        await ctx.db
          .query("schoolClassInviteCodes")
          .withIndex("by_classId_and_role", (q) => q.eq("classId", classId))
          .collect()
      ).toHaveLength(0);
      expect(
        await ctx.db
          .query("notifications")
          .withIndex("by_entityType_and_entityId", (q) =>
            q.eq("entityType", "schoolClasses").eq("entityId", classId)
          )
          .collect()
      ).toHaveLength(0);
      expect(
        await ctx.db
          .query("notificationEntityMutes")
          .withIndex("by_entityType_and_entityId", (q) =>
            q.eq("entityType", "schoolClasses").eq("entityId", classId)
          )
          .collect()
      ).toHaveLength(0);

      const counts = await ctx.db
        .query("notificationCounts")
        .withIndex("by_userId", (q) => q.eq("userId", viewer.userId))
        .collect();

      expect(counts).toHaveLength(1);
      expect(counts[0]?.unreadCount).toBe(0);
    });
  });
});

describe("triggers/schools/cleanupDeletedForum", () => {
  it("removes rows owned by a deleted forum", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    await t.mutation(async (ctx) => {
      const viewer = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "forum",
      });
      const schoolId = await insertSchool(ctx, viewer.userId);
      const classId = await insertClass(ctx, schoolId, viewer.userId);
      const forumId = await insertForum(ctx, classId, schoolId, viewer.userId);
      await ctx.db.insert("schoolClassForumReactions", {
        forumId,
        userId: viewer.userId,
        emoji: "👍",
      });
      await ctx.db.insert("schoolClassForumPendingUploads", {
        forumId,
        classId,
        uploadedBy: viewer.userId,
        name: "draft.txt",
      });
      await ctx.db.insert("schoolClassForumReadStates", {
        forumId,
        classId,
        userId: viewer.userId,
        lastReadSequence: 0,
      });
      await insertUnreadNotification(ctx, {
        entityId: forumId,
        entityType: "schoolClassForums",
        recipientId: viewer.userId,
      });
      await ctx.db.insert("notificationEntityMutes", {
        entityId: forumId,
        entityType: "schoolClassForums",
        mutedAt: NOW,
        userId: viewer.userId,
      });
      await ctx.runMutation(
        internal.triggers.schools.cleanup.cleanupDeletedForum,
        {
          forumId,
        }
      );

      expect(
        await ctx.db
          .query("schoolClassForumReactions")
          .withIndex("by_forumId_and_emoji_and_userId", (q) =>
            q.eq("forumId", forumId)
          )
          .collect()
      ).toHaveLength(0);
      expect(
        await ctx.db
          .query("schoolClassForumPendingUploads")
          .withIndex("by_forumId_and_uploadedBy", (q) =>
            q.eq("forumId", forumId)
          )
          .collect()
      ).toHaveLength(0);
      expect(
        await ctx.db
          .query("schoolClassForumReadStates")
          .withIndex("by_forumId_and_userId", (q) => q.eq("forumId", forumId))
          .collect()
      ).toHaveLength(0);
      expect(
        await ctx.db
          .query("notifications")
          .withIndex("by_entityType_and_entityId", (q) =>
            q.eq("entityType", "schoolClassForums").eq("entityId", forumId)
          )
          .collect()
      ).toHaveLength(0);
      expect(
        await ctx.db
          .query("notificationEntityMutes")
          .withIndex("by_entityType_and_entityId", (q) =>
            q.eq("entityType", "schoolClassForums").eq("entityId", forumId)
          )
          .collect()
      ).toHaveLength(0);

      const counts = await ctx.db
        .query("notificationCounts")
        .withIndex("by_userId", (q) => q.eq("userId", viewer.userId))
        .collect();

      expect(counts).toHaveLength(1);
      expect(counts[0]?.unreadCount).toBe(0);
    });
  });
});

describe("triggers/schools/cleanupDeletedForumPost", () => {
  it("removes rows owned by a deleted forum post", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    await t.mutation(async (ctx) => {
      const viewer = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "post",
      });
      const schoolId = await insertSchool(ctx, viewer.userId);
      const classId = await insertClass(ctx, schoolId, viewer.userId);
      const forumId = await insertForum(ctx, classId, schoolId, viewer.userId);
      const postId = await insertForumPost(
        ctx,
        classId,
        forumId,
        viewer.userId
      );
      await ctx.db.insert("schoolClassForumPostReactions", {
        postId,
        userId: viewer.userId,
        emoji: "🔥",
      });
      await insertUnreadNotification(ctx, {
        entityId: postId,
        entityType: "schoolClassForumPosts",
        recipientId: viewer.userId,
      });
      await ctx.db.insert("notificationEntityMutes", {
        entityId: postId,
        entityType: "schoolClassForumPosts",
        mutedAt: NOW,
        userId: viewer.userId,
      });
      await ctx.runMutation(
        internal.triggers.schools.cleanup.cleanupDeletedForumPost,
        { postId }
      );

      expect(
        await ctx.db
          .query("schoolClassForumPostReactions")
          .withIndex("by_postId_and_emoji_and_userId", (q) =>
            q.eq("postId", postId)
          )
          .collect()
      ).toHaveLength(0);
      expect(
        await ctx.db
          .query("notifications")
          .withIndex("by_entityType_and_entityId", (q) =>
            q.eq("entityType", "schoolClassForumPosts").eq("entityId", postId)
          )
          .collect()
      ).toHaveLength(0);
      expect(
        await ctx.db
          .query("notificationEntityMutes")
          .withIndex("by_entityType_and_entityId", (q) =>
            q.eq("entityType", "schoolClassForumPosts").eq("entityId", postId)
          )
          .collect()
      ).toHaveLength(0);

      const counts = await ctx.db
        .query("notificationCounts")
        .withIndex("by_userId", (q) => q.eq("userId", viewer.userId))
        .collect();

      expect(counts).toHaveLength(1);
      expect(counts[0]?.unreadCount).toBe(0);
    });
  });
});
