import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  forumPostsByAuthorSequence,
  forumPostsBySequence,
} from "@repo/backend/convex/classes/forums/aggregate";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { describe, expect, it, vi } from "vitest";

const FORUM_CREATED_AT = Date.UTC(2026, 3, 18, 8, 0, 0);

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
    updatedAt: FORUM_CREATED_AT,
    createdBy: userId,
    updatedBy: userId,
  });
}

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
    updatedAt: FORUM_CREATED_AT,
    createdBy: userId,
    updatedBy: userId,
  });
}

async function insertMemberships(
  ctx: MutationCtx,
  {
    classId,
    schoolId,
    viewerId,
    authorId,
  }: {
    classId: Id<"schoolClasses">;
    schoolId: Id<"schools">;
    viewerId: Id<"users">;
    authorId: Id<"users">;
  }
) {
  await ctx.db.insert("schoolMembers", {
    schoolId,
    userId: viewerId,
    role: "student",
    status: "active",
    joinedAt: FORUM_CREATED_AT,
    updatedAt: FORUM_CREATED_AT,
  });
  await ctx.db.insert("schoolMembers", {
    schoolId,
    userId: authorId,
    role: "teacher",
    status: "active",
    joinedAt: FORUM_CREATED_AT,
    updatedAt: FORUM_CREATED_AT,
  });
  await ctx.db.insert("schoolClassMembers", {
    classId,
    schoolId,
    userId: viewerId,
    role: "student",
    updatedAt: FORUM_CREATED_AT,
  });
  await ctx.db.insert("schoolClassMembers", {
    classId,
    schoolId,
    userId: authorId,
    role: "teacher",
    teacherRole: "primary",
    updatedAt: FORUM_CREATED_AT,
  });
}

async function insertForum(
  ctx: MutationCtx,
  {
    classId,
    schoolId,
    createdBy,
    postCount,
    title,
  }: {
    classId: Id<"schoolClasses">;
    schoolId: Id<"schools">;
    createdBy: Id<"users">;
    postCount: number;
    title: string;
  }
) {
  return await ctx.db.insert("schoolClassForums", {
    classId,
    schoolId,
    title,
    body: `${title} body`,
    tag: "general",
    status: "open",
    isPinned: false,
    postCount,
    nextPostSequence: postCount + 1,
    reactionCounts: [],
    lastPostAt: FORUM_CREATED_AT + postCount,
    lastPostBy: createdBy,
    createdBy,
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

  const postId = await ctx.db.insert("schoolClassForumPosts", {
    forumId,
    classId,
    body: `post-${sequence}`,
    mentions: [],
    reactionCounts: [],
    replyCount: 0,
    sequence,
    createdBy: authorId,
    updatedAt: createdAt,
  });
  const post = await ctx.db.get("schoolClassForumPosts", postId);

  if (!post) {
    throw new Error("Forum post not found after insert.");
  }

  await forumPostsBySequence.insert(ctx, post);
  await forumPostsByAuthorSequence.insert(ctx, post);

  return postId;
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

describe("classes/forums/queries/pages", () => {
  it("returns the newest posts from the requested forum window", async () => {
    const { identity, t } = await seedForum();
    const forumId = await t.mutation(async (ctx) => {
      const forumId = await insertForum(ctx, {
        classId: identity.classId,
        schoolId: identity.schoolId,
        createdBy: identity.authorId,
        postCount: 3,
        title: "Target forum",
      });
      const otherForumId = await insertForum(ctx, {
        classId: identity.classId,
        schoolId: identity.schoolId,
        createdBy: identity.authorId,
        postCount: 1,
        title: "Other forum",
      });

      await insertForumPost(ctx, {
        authorId: identity.authorId,
        classId: identity.classId,
        forumId: otherForumId,
        sequence: 1,
      });

      for (const sequence of [1, 2, 3]) {
        await insertForumPost(ctx, {
          authorId: identity.authorId,
          classId: identity.classId,
          forumId,
          sequence,
        });
      }

      return forumId;
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.classes.forums.queries.pages.getForumPostsWindow, {
        forumId,
        numItems: 2,
        order: "desc",
      });

    expect(result.page.map((post) => post.sequence)).toEqual([3, 2]);
    expect(result.hasMore).toBe(true);
    expect(result.page.every((post) => post.forumId === forumId)).toBe(true);
  });

  it("keeps older windows gapless when pinned by index keys", async () => {
    const { identity, t } = await seedForum();
    const forumId = await t.mutation(async (ctx) => {
      const forumId = await insertForum(ctx, {
        classId: identity.classId,
        schoolId: identity.schoolId,
        createdBy: identity.authorId,
        postCount: 5,
        title: "Gapless forum",
      });

      for (const sequence of [1, 2, 3, 4, 5]) {
        await insertForumPost(ctx, {
          authorId: identity.authorId,
          classId: identity.classId,
          forumId,
          sequence,
        });
      }

      return forumId;
    });

    const client = t.withIdentity({
      subject: identity.authUserId,
      sessionId: identity.sessionId,
    });
    const latest = await client.query(
      api.classes.forums.queries.pages.getForumPostsWindow,
      {
        forumId,
        numItems: 2,
        order: "desc",
      }
    );
    const older = await client.query(
      api.classes.forums.queries.pages.getForumPostsWindow,
      {
        forumId,
        numItems: 2,
        order: "desc",
        startInclusive: false,
        startIndexKey: latest.indexKeys.at(-1),
      }
    );

    expect(latest.page.map((post) => post.sequence)).toEqual([5, 4]);
    expect(older.page.map((post) => post.sequence)).toEqual([3, 2]);
    expect(
      [...older.page]
        .reverse()
        .concat([...latest.page].reverse())
        .map((post) => post.sequence)
    ).toEqual([2, 3, 4, 5]);
  });

  it("returns the stable anchor index key for one post", async () => {
    const { identity, t } = await seedForum();
    const target = await t.mutation(async (ctx) => {
      const forumId = await insertForum(ctx, {
        classId: identity.classId,
        schoolId: identity.schoolId,
        createdBy: identity.authorId,
        postCount: 3,
        title: "Anchor forum",
      });

      await insertForumPost(ctx, {
        authorId: identity.authorId,
        classId: identity.classId,
        forumId,
        sequence: 1,
      });
      const postId = await insertForumPost(ctx, {
        authorId: identity.authorId,
        classId: identity.classId,
        forumId,
        sequence: 2,
      });
      await insertForumPost(ctx, {
        authorId: identity.authorId,
        classId: identity.classId,
        forumId,
        sequence: 3,
      });

      return { forumId, postId };
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.classes.forums.queries.pages.getForumPostAnchor, target);

    expect(result.postId).toBe(target.postId);
    expect(result.indexKey[0]).toBe(target.forumId);
    expect(result.indexKey[1]).toBe(2);
    expect(result.indexKey.at(-1)).toBe(target.postId);
  });

  it("fails cleanly when the target post does not belong to the forum", async () => {
    const { identity, t } = await seedForum();
    const target = await t.mutation(async (ctx) => {
      const forumId = await insertForum(ctx, {
        classId: identity.classId,
        schoolId: identity.schoolId,
        createdBy: identity.authorId,
        postCount: 1,
        title: "First forum",
      });
      const otherForumId = await insertForum(ctx, {
        classId: identity.classId,
        schoolId: identity.schoolId,
        createdBy: identity.authorId,
        postCount: 1,
        title: "Second forum",
      });
      const postId = await insertForumPost(ctx, {
        authorId: identity.authorId,
        classId: identity.classId,
        forumId: otherForumId,
        sequence: 1,
      });

      return { forumId, postId };
    });

    await expect(
      t
        .withIdentity({
          subject: identity.authUserId,
          sessionId: identity.sessionId,
        })
        .query(api.classes.forums.queries.pages.getForumPostAnchor, target)
    ).rejects.toThrow("Forum post not found.");
  });
});
