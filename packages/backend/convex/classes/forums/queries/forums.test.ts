import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  forumPostsByAuthorSequence,
  forumPostsBySequence,
} from "@repo/backend/convex/classes/forums/aggregate";
import {
  insertClass,
  insertClassMembership,
  insertSchool,
  insertSchoolMembership,
} from "@repo/backend/convex/classes/test.helpers";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { describe, expect, it, vi } from "vitest";

const FORUM_CREATED_AT = Date.UTC(2026, 3, 18, 8, 0, 0);
const READ_AT = Date.UTC(2026, 3, 18, 8, 5, 0);
const LAST_POST_AT = Date.UTC(2026, 3, 18, 8, 10, 0);

/** Insert one forum thread with explicit denormalized list metadata. */
async function insertForum(
  ctx: MutationCtx,
  {
    classId,
    schoolId,
    createdBy,
    lastPostAt,
    lastPostBy,
    postCount,
    title,
  }: {
    classId: Id<"schoolClasses">;
    schoolId: Id<"schools">;
    createdBy: Id<"users">;
    lastPostAt: number;
    lastPostBy?: Id<"users">;
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
    lastPostAt,
    lastPostBy,
    createdBy,
    updatedAt: lastPostAt,
  });
}

/** Insert one forum post at a controlled creation time. */
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

describe("classes/forums/queries/forums:getForums", () => {
  it("marks a forum unread when another user posted after the stored read boundary", async () => {
    vi.setSystemTime(new Date(FORUM_CREATED_AT));

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
      const schoolId = await insertSchool(ctx, {
        now: FORUM_CREATED_AT,
        userId: author.userId,
      });
      const classId = await insertClass(ctx, {
        now: FORUM_CREATED_AT,
        schoolId,
        userId: author.userId,
      });

      await insertSchoolMembership(ctx, {
        now: FORUM_CREATED_AT,
        role: "student",
        schoolId,
        userId: viewer.userId,
      });
      await insertSchoolMembership(ctx, {
        now: FORUM_CREATED_AT,
        role: "teacher",
        schoolId,
        userId: author.userId,
      });
      await insertClassMembership(ctx, {
        now: FORUM_CREATED_AT,
        role: "student",
        classId,
        schoolId,
        userId: viewer.userId,
      });
      await insertClassMembership(ctx, {
        now: FORUM_CREATED_AT,
        role: "teacher",
        classId,
        schoolId,
        userId: author.userId,
      });

      const forumId = await insertForum(ctx, {
        classId,
        schoolId,
        createdBy: author.userId,
        lastPostAt: LAST_POST_AT,
        lastPostBy: author.userId,
        postCount: 2,
        title: "Unread forum",
      });
      await insertForumPost(ctx, {
        body: "first",
        classId,
        createdAt: READ_AT,
        createdBy: author.userId,
        forumId,
        sequence: 1,
      });

      await insertForumPost(ctx, {
        body: "second",
        classId,
        createdAt: LAST_POST_AT,
        createdBy: author.userId,
        forumId,
        sequence: 2,
      });

      await ctx.db.insert("schoolClassForumReadStates", {
        forumId,
        classId,
        userId: viewer.userId,
        lastReadSequence: 1,
      });

      return { ...viewer, classId };
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.classes.forums.queries.forums.getForums, {
        classId: identity.classId,
        paginationOpts: { cursor: null, numItems: 20 },
      });

    expect(result.page).toHaveLength(1);
    expect(result.page[0]?.unreadCount).toBe(1);
  });

  it("keeps a forum read when only the viewer posted and no read state exists", async () => {
    vi.setSystemTime(new Date(FORUM_CREATED_AT));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const viewer = await seedAuthenticatedUser(ctx, {
        now: FORUM_CREATED_AT,
        suffix: "solo-viewer",
      });
      const schoolId = await insertSchool(ctx, {
        now: FORUM_CREATED_AT,
        userId: viewer.userId,
      });
      const classId = await insertClass(ctx, {
        now: FORUM_CREATED_AT,
        schoolId,
        userId: viewer.userId,
      });

      await insertSchoolMembership(ctx, {
        now: FORUM_CREATED_AT,
        role: "teacher",
        schoolId,
        userId: viewer.userId,
      });
      await insertClassMembership(ctx, {
        now: FORUM_CREATED_AT,
        role: "teacher",
        classId,
        schoolId,
        userId: viewer.userId,
      });

      const forumId = await insertForum(ctx, {
        classId,
        schoolId,
        createdBy: viewer.userId,
        lastPostAt: LAST_POST_AT,
        lastPostBy: viewer.userId,
        postCount: 1,
        title: "Viewer-only forum",
      });

      await insertForumPost(ctx, {
        body: "viewer post",
        classId,
        createdAt: LAST_POST_AT,
        createdBy: viewer.userId,
        forumId,
        sequence: 1,
      });

      return { ...viewer, classId };
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.classes.forums.queries.forums.getForums, {
        classId: identity.classId,
        paginationOpts: { cursor: null, numItems: 20 },
      });

    expect(result.page).toHaveLength(1);
    expect(result.page[0]?.unreadCount).toBe(0);
  });
});
