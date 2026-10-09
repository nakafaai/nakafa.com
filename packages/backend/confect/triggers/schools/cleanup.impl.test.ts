import { describe, expect, it } from "@effect/vitest";
import {
  forumPostsByAuthorSequence,
  forumPostsBySequence,
} from "@repo/backend/confect/classes/forums/aggregate";
import { FORUM_PENDING_UPLOAD_EXPIRATION_MS } from "@repo/backend/confect/classes/forums/attachments/constants";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api, internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Array as Arr } from "effect";

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

describe("triggers/schools/cleanupDeletedClass", () => {
  it("continues every full batch until a deleted class has no dependent rows", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const t = createConvexTestWithBetterAuth();
    const classId = await t.mutation(async (ctx) => {
      const viewer = await seedAuthenticatedUser(ctx, { now: NOW });
      const schoolId = await insertSchool(ctx, viewer.userId);
      const id = await insertClass(ctx, schoolId, viewer.userId);
      for (let index = 0; index < 100; index += 1) {
        const userId = await ctx.db.insert("users", {
          authId: `class-member-${index}`,
          credits: 0,
          creditsResetAt: NOW,
          email: `member-${index}@example.com`,
          name: `Member ${index}`,
          plan: "free",
        });
        await ctx.db.insert("schoolClassMembers", {
          classId: id,
          schoolId,
          userId,
          role: "student",
          updatedAt: NOW,
        });
        await ctx.db.insert("schoolClassInviteCodes", {
          classId: id,
          schoolId,
          role: "student",
          code: `code-${index}`,
          enabled: true,
          currentUsage: 0,
          createdBy: viewer.userId,
          updatedAt: NOW,
        });
      }
      for (let index = 0; index < 25; index += 1) {
        await insertForum(ctx, id, schoolId, viewer.userId);
        await ctx.db.insert("schoolClassMaterialGroups", {
          classId: id,
          schoolId,
          name: `Group ${index}`,
          description: "Cleanup target",
          order: index,
          status: "draft",
          materialCount: 0,
          childGroupCount: 0,
          createdBy: viewer.userId,
          updatedAt: NOW,
        });
      }
      await ctx.db.delete("schoolClasses", id);
      return id;
    });
    await t.mutation(internal.triggers.schools.cleanup.cleanupDeletedClass, {
      classId,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const state = await t.query(async (ctx) => ({
      members: await ctx.db.query("schoolClassMembers").collect(),
      invites: await ctx.db.query("schoolClassInviteCodes").collect(),
      forums: await ctx.db.query("schoolClassForums").collect(),
      groups: await ctx.db.query("schoolClassMaterialGroups").collect(),
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
    expect(state.members).toEqual([]);
    expect(state.invites).toEqual([]);
    expect(state.forums).toEqual([]);
    expect(state.groups).toEqual([]);
    expect(Arr.every(state.jobs, (job) => job.state.kind === "success")).toBe(
      true
    );
    expect(
      Arr.filter(
        state.jobs,
        (job) => job.name === "triggers/schools/cleanup:cleanupDeletedClass"
      )
    ).toHaveLength(4);
  });
  it("removes top-level rows owned by a deleted class", async () => {
    vi.setSystemTime(NOW);

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
    });
  });
});

describe("triggers/schools/cleanupDeletedForum", () => {
  it("removes rows owned by a deleted forum", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const viewer = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "forum",
      });
      const schoolId = await insertSchool(ctx, viewer.userId);
      const classId = await insertClass(ctx, schoolId, viewer.userId);
      await ctx.db.insert("schoolMembers", {
        joinedAt: NOW,
        role: "admin",
        schoolId,
        status: "active",
        updatedAt: NOW,
        userId: viewer.userId,
      });
      await ctx.db.insert("schoolClassMembers", {
        classId,
        role: "teacher",
        schoolId,
        teacherRole: "primary",
        updatedAt: NOW,
        userId: viewer.userId,
      });
      const forumId = await insertForum(ctx, classId, schoolId, viewer.userId);
      await ctx.db.insert("schoolClassForumReactions", {
        forumId,
        userId: viewer.userId,
        emoji: "👍",
      });
      await ctx.db.insert("schoolClassForumPendingUploads", {
        classId,
        expiresAt: NOW + FORUM_PENDING_UPLOAD_EXPIRATION_MS,
        forumId,
        uploadToken: "forum-upload-token",
        uploadedBy: viewer.userId,
        name: "draft.txt",
      });
      await ctx.db.insert("schoolClassForumReadStates", {
        forumId,
        classId,
        userId: viewer.userId,
        lastReadSequence: 0,
      });

      return {
        authUserId: viewer.authUserId,
        forumId,
        sessionId: viewer.sessionId,
        userId: viewer.userId,
      };
    });
    const owner = t.withIdentity({
      sessionId: seeded.sessionId,
      subject: seeded.authUserId,
    });
    const postId = await owner.mutation(
      api.classes.forums.mutations.posts.createForumPost,
      {
        body: "Post body",
        forumId: seeded.forumId,
      }
    );

    await t.mutation(async (ctx) => {
      await ctx.db.insert("schoolClassForumPostReactions", {
        postId,
        userId: seeded.userId,
        emoji: "🔥",
      });
    });

    await t.mutation(internal.triggers.schools.cleanup.cleanupDeletedForum, {
      forumId: seeded.forumId,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();

    const result = await t.query(async (ctx) => ({
      aggregateCount: await forumPostsBySequence.count(ctx, {
        namespace: seeded.forumId,
      }),
      authorCount: await forumPostsByAuthorSequence.count(ctx, {
        namespace: [seeded.forumId, seeded.userId],
      }),
      pendingUploads: await ctx.db
        .query("schoolClassForumPendingUploads")
        .withIndex("by_forumId_and_uploadedBy", (query) =>
          query.eq("forumId", seeded.forumId)
        )
        .collect(),
      post: await ctx.db.get("schoolClassForumPosts", postId),
      postReactions: await ctx.db
        .query("schoolClassForumPostReactions")
        .withIndex("by_postId_and_emoji_and_userId", (query) =>
          query.eq("postId", postId)
        )
        .collect(),
      reactions: await ctx.db
        .query("schoolClassForumReactions")
        .withIndex("by_forumId_and_emoji_and_userId", (query) =>
          query.eq("forumId", seeded.forumId)
        )
        .collect(),
      readStates: await ctx.db
        .query("schoolClassForumReadStates")
        .withIndex("by_forumId_and_userId", (query) =>
          query.eq("forumId", seeded.forumId)
        )
        .collect(),
    }));

    expect(result).toEqual({
      aggregateCount: 0,
      authorCount: 0,
      pendingUploads: [],
      post: null,
      postReactions: [],
      reactions: [],
      readStates: [],
    });
  });
});
