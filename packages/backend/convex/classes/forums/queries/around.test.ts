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

const STARTED_AT = Date.UTC(2026, 3, 18, 8, 0, 0);

/** Insert one school row with the minimum fields required by the schema. */
async function insertSchool(ctx: MutationCtx, userId: Id<"users">) {
  return await ctx.db.insert("schools", {
    name: "Nakafa School",
    slug: `nakafa-around-${userId}`,
    email: `${userId}@example.com`,
    city: "Jakarta",
    province: "DKI Jakarta",
    type: "high-school",
    currentStudents: 0,
    currentTeachers: 0,
    updatedAt: STARTED_AT,
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
    updatedAt: STARTED_AT,
    createdBy: userId,
    updatedBy: userId,
  });
}

/** Insert one active school membership for the given user. */
async function insertSchoolMembership(
  ctx: MutationCtx,
  {
    role,
    schoolId,
    userId,
  }: {
    role: "admin" | "student" | "teacher";
    schoolId: Id<"schools">;
    userId: Id<"users">;
  }
) {
  await ctx.db.insert("schoolMembers", {
    schoolId,
    userId,
    role,
    status: "active",
    joinedAt: STARTED_AT,
    updatedAt: STARTED_AT,
  });
}

/** Insert one active class membership for the given user. */
async function insertClassMembership(
  ctx: MutationCtx,
  {
    role,
    classId,
    schoolId,
    userId,
  }: {
    role: "student" | "teacher";
    classId: Id<"schoolClasses">;
    schoolId: Id<"schools">;
    userId: Id<"users">;
  }
) {
  await ctx.db.insert("schoolClassMembers", {
    classId,
    schoolId,
    userId,
    role,
    ...(role === "teacher" ? { teacherRole: "primary" as const } : {}),
    updatedAt: STARTED_AT,
  });
}

/** Insert one forum row with explicit list metadata. */
async function insertForum(
  ctx: MutationCtx,
  {
    classId,
    schoolId,
    createdBy,
    postCount,
  }: {
    classId: Id<"schoolClasses">;
    schoolId: Id<"schools">;
    createdBy: Id<"users">;
    postCount: number;
  }
) {
  return await ctx.db.insert("schoolClassForums", {
    classId,
    schoolId,
    title: "Around query forum",
    body: "Around query body",
    tag: "general",
    status: "open",
    isPinned: false,
    postCount,
    nextPostSequence: postCount + 1,
    reactionCounts: [],
    lastPostAt: STARTED_AT + postCount,
    lastPostBy: createdBy,
    createdBy,
    updatedAt: STARTED_AT + postCount,
  });
}

/** Insert one forum post at a controlled creation time and aggregate sequence. */
async function insertForumPost(
  ctx: MutationCtx,
  {
    body,
    classId,
    createdAt,
    createdBy,
    forumId,
    sequence,
  }: {
    body: string;
    classId: Id<"schoolClasses">;
    createdAt: number;
    createdBy: Id<"users">;
    forumId: Id<"schoolClassForums">;
    sequence: number;
  }
) {
  vi.setSystemTime(new Date(createdAt));

  const postId = await ctx.db.insert("schoolClassForumPosts", {
    forumId,
    classId,
    body,
    mentions: [],
    reactionCounts: [],
    replyCount: 0,
    sequence,
    createdBy,
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

describe("classes/forums/queries/around:getForumPostsAround", () => {
  it("includes the exact target post and keeps the returned bounds consistent", async () => {
    vi.setSystemTime(new Date(STARTED_AT));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const viewer = await seedAuthenticatedUser(ctx, {
        now: STARTED_AT,
        suffix: "around-viewer",
      });
      const author = await seedAuthenticatedUser(ctx, {
        now: STARTED_AT,
        suffix: "around-author",
      });
      const schoolId = await insertSchool(ctx, author.userId);
      const classId = await insertClass(ctx, schoolId, author.userId);

      await insertSchoolMembership(ctx, {
        role: "student",
        schoolId,
        userId: viewer.userId,
      });
      await insertSchoolMembership(ctx, {
        role: "teacher",
        schoolId,
        userId: author.userId,
      });
      await insertClassMembership(ctx, {
        role: "student",
        classId,
        schoolId,
        userId: viewer.userId,
      });
      await insertClassMembership(ctx, {
        role: "teacher",
        classId,
        schoolId,
        userId: author.userId,
      });

      const forumId = await insertForum(ctx, {
        classId,
        schoolId,
        createdBy: author.userId,
        postCount: 7,
      });
      const postIds = await Promise.all(
        [1, 2, 3, 4, 5, 6, 7].map((sequence) =>
          insertForumPost(ctx, {
            body: `post-${sequence}`,
            classId,
            createdAt: STARTED_AT + sequence * 1000,
            createdBy: author.userId,
            forumId,
            sequence,
          })
        )
      );

      return {
        ...viewer,
        forumId,
        targetPostId: postIds[3],
        expectedNewestPostId: postIds[5],
        expectedOldestPostId: postIds[1],
      };
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.classes.forums.queries.around.getForumPostsAround, {
        forumId: identity.forumId,
        limit: 5,
        targetPostId: identity.targetPostId,
      });

    expect(result.posts).toHaveLength(5);
    expect(result.posts[result.targetIndex]?._id).toBe(identity.targetPostId);
    expect(result.oldestPostId).toBe(identity.expectedOldestPostId);
    expect(result.newestPostId).toBe(identity.expectedNewestPostId);
    expect(result.hasMoreBefore).toBe(true);
    expect(result.hasMoreAfter).toBe(true);
  });
});
