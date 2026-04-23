import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { afterEach, describe, expect, it, vi } from "vitest";

const FORUM_CREATED_AT = Date.UTC(2026, 3, 18, 8, 0, 0);

async function insertSchool(ctx: MutationCtx, userId: Id<"users">) {
  return await ctx.db.insert("schools", {
    city: "Jakarta",
    createdBy: userId,
    currentStudents: 0,
    currentTeachers: 0,
    email: `${userId}@example.com`,
    name: "Nakafa School",
    province: "DKI Jakarta",
    slug: `nakafa-${userId}`,
    type: "high-school",
    updatedAt: FORUM_CREATED_AT,
    updatedBy: userId,
  });
}

async function insertClass(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  userId: Id<"users">
) {
  return await ctx.db.insert("schoolClasses", {
    createdBy: userId,
    image: "retro",
    isArchived: false,
    name: "Class 10A",
    schoolId,
    studentCount: 0,
    subject: "Mathematics",
    teacherCount: 0,
    updatedAt: FORUM_CREATED_AT,
    updatedBy: userId,
    visibility: "public",
    year: "2026/2027",
  });
}

async function insertMemberships(
  ctx: MutationCtx,
  {
    authorId,
    classId,
    schoolId,
    viewerId,
  }: {
    authorId: Id<"users">;
    classId: Id<"schoolClasses">;
    schoolId: Id<"schools">;
    viewerId: Id<"users">;
  }
) {
  await ctx.db.insert("schoolMembers", {
    joinedAt: FORUM_CREATED_AT,
    role: "student",
    schoolId,
    status: "active",
    updatedAt: FORUM_CREATED_AT,
    userId: viewerId,
  });
  await ctx.db.insert("schoolMembers", {
    joinedAt: FORUM_CREATED_AT,
    role: "teacher",
    schoolId,
    status: "active",
    updatedAt: FORUM_CREATED_AT,
    userId: authorId,
  });
  await ctx.db.insert("schoolClassMembers", {
    classId,
    role: "student",
    schoolId,
    updatedAt: FORUM_CREATED_AT,
    userId: viewerId,
  });
  await ctx.db.insert("schoolClassMembers", {
    classId,
    role: "teacher",
    schoolId,
    teacherRole: "primary",
    updatedAt: FORUM_CREATED_AT,
    userId: authorId,
  });
}

async function insertForum(
  ctx: MutationCtx,
  {
    classId,
    createdBy,
    postCount,
    schoolId,
    title,
  }: {
    classId: Id<"schoolClasses">;
    createdBy: Id<"users">;
    postCount: number;
    schoolId: Id<"schools">;
    title: string;
  }
) {
  return await ctx.db.insert("schoolClassForums", {
    body: `${title} body`,
    classId,
    createdBy,
    isPinned: false,
    lastPostAt: FORUM_CREATED_AT + postCount,
    lastPostBy: createdBy,
    nextPostSequence: postCount + 1,
    postCount,
    reactionCounts: [],
    schoolId,
    status: "open",
    tag: "general",
    title,
    updatedAt: FORUM_CREATED_AT + postCount,
  });
}

async function insertForumPost(
  ctx: MutationCtx,
  {
    authorId,
    classId,
    forumId,
    sequence,
  }: {
    authorId: Id<"users">;
    classId: Id<"schoolClasses">;
    forumId: Id<"schoolClassForums">;
    sequence: number;
  }
) {
  const createdAt = FORUM_CREATED_AT + sequence * 1000;

  vi.setSystemTime(new Date(createdAt));

  return await ctx.db.insert("schoolClassForumPosts", {
    body: `post-${sequence}`,
    classId,
    createdBy: authorId,
    forumId,
    mentions: [],
    reactionCounts: [],
    replyCount: 0,
    sequence,
    updatedAt: createdAt,
  });
}

async function seedForum() {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation(async (ctx) => {
    const viewer = await seedAuthenticatedUser(ctx, {
      now: FORUM_CREATED_AT,
      suffix: "viewer",
    });
    const author = await seedAuthenticatedUser(ctx, {
      now: FORUM_CREATED_AT,
      suffix: "author",
    });
    const schoolId = await insertSchool(ctx, author.userId);
    const classId = await insertClass(ctx, schoolId, author.userId);

    await insertMemberships(ctx, {
      authorId: author.userId,
      classId,
      schoolId,
      viewerId: viewer.userId,
    });

    return {
      authorId: author.userId,
      authUserId: viewer.authUserId,
      classId,
      schoolId,
      sessionId: viewer.sessionId,
      viewerId: viewer.userId,
    };
  });

  return {
    identity,
    t,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("classes/forums/queries/pages", () => {
  it("returns the full transcript in ascending order with unread metadata", async () => {
    const { identity, t } = await seedForum();
    const forumId = await t.mutation(async (ctx) => {
      const createdForumId = await insertForum(ctx, {
        classId: identity.classId,
        createdBy: identity.authorId,
        postCount: 4,
        schoolId: identity.schoolId,
        title: "Latest forum",
      });

      for (const sequence of [1, 2, 3, 4]) {
        await insertForumPost(ctx, {
          authorId: identity.authorId,
          classId: identity.classId,
          forumId: createdForumId,
          sequence,
        });
      }

      await ctx.db.insert("schoolClassForumReadStates", {
        classId: identity.classId,
        forumId: createdForumId,
        lastReadSequence: 2,
        userId: identity.viewerId,
      });

      return createdForumId;
    });

    const result = await t
      .withIdentity({
        sessionId: identity.sessionId,
        subject: identity.authUserId,
      })
      .query(api.classes.forums.queries.pages.getForumPosts, {
        forumId,
      });

    expect(result.map((post) => post.sequence)).toEqual([1, 2, 3, 4]);
    expect(result.map((post) => post.isUnread)).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });

  it("never marks the viewer's own posts as unread", async () => {
    const { identity, t } = await seedForum();
    const forumId = await t.mutation(async (ctx) => {
      const createdForumId = await insertForum(ctx, {
        classId: identity.classId,
        createdBy: identity.viewerId,
        postCount: 2,
        schoolId: identity.schoolId,
        title: "Viewer forum",
      });

      for (const sequence of [1, 2]) {
        await insertForumPost(ctx, {
          authorId: identity.viewerId,
          classId: identity.classId,
          forumId: createdForumId,
          sequence,
        });
      }

      return createdForumId;
    });

    const result = await t
      .withIdentity({
        sessionId: identity.sessionId,
        subject: identity.authUserId,
      })
      .query(api.classes.forums.queries.pages.getForumPosts, {
        forumId,
      });

    expect(result.map((post) => post.isUnread)).toEqual([false, false]);
  });
});
