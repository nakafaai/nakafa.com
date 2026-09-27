import { expect, it } from "@effect/vitest";
import postsTable from "@repo/backend/confect/_generated/tables/schoolClassForumPosts";
import {
  forumPostsByAuthorSequence,
  forumPostsBySequence,
} from "@repo/backend/confect/classes/forums/aggregate";
import {
  insertClass,
  insertSchool,
} from "@repo/backend/confect/classes/test.helpers";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { internal } from "@repo/backend/convex/_generated/api";
import { Schema } from "effect";

it("removes one user's community state in bounded phases without deleting shared discussion", async () => {
  const now = Date.UTC(2026, 8, 1);
  const t = createConvexTestWithBetterAuth();
  const seeded = await t.mutation(async (ctx) => {
    const owner = await seedAuthenticatedUser(ctx, {
      now,
      suffix: "deleted-community",
    });
    const other = await seedAuthenticatedUser(ctx, {
      now,
      suffix: "retained-community",
    });
    const schoolId = await insertSchool(ctx, { now, userId: other.userId });
    const classId = await insertClass(ctx, {
      now,
      schoolId,
      userId: other.userId,
    });
    const forumId = await ctx.db.insert("schoolClassForums", {
      classId,
      schoolId,
      title: "Retained discussion",
      body: "Shared discussion",
      tag: "general",
      status: "open",
      isPinned: false,
      postCount: 1,
      nextPostSequence: 2,
      reactionCounts: [{ emoji: "👍", count: 2 }],
      lastPostAt: now,
      lastPostBy: other.userId,
      createdBy: other.userId,
      updatedAt: now,
    });
    const postId = await ctx.db.insert("schoolClassForumPosts", {
      forumId,
      classId,
      body: "Retained post",
      mentions: [],
      replyCount: 0,
      reactionCounts: [{ emoji: "👍", count: 2 }],
      sequence: 1,
      createdBy: other.userId,
      updatedAt: now,
    });
    const post = Schema.decodeUnknownSync(postsTable.Doc)(
      await ctx.db.get("schoolClassForumPosts", postId)
    );
    await forumPostsBySequence.insert(ctx, post);
    await forumPostsByAuthorSequence.insert(ctx, post);
    for (const userId of [owner.userId, other.userId]) {
      await ctx.db.insert("schoolClassForumPostReactions", {
        postId,
        userId,
        emoji: "👍",
      });
      await ctx.db.insert("schoolClassForumReactions", {
        forumId,
        userId,
        emoji: "👍",
      });
      await ctx.db.insert("schoolClassForumReadStates", {
        classId,
        forumId,
        userId,
        lastReadSequence: 0,
      });
      await ctx.db.insert("schoolClassForumPendingUploads", {
        classId,
        forumId,
        uploadedBy: userId,
        expiresAt: now + 60_000,
        uploadToken: userId,
      });
    }
    return {
      userId: owner.userId,
      otherId: other.userId,
      forumId,
      postId,
      schoolId,
      classId,
    };
  });
  for (const table of [
    "schoolClassForumPostReactions",
    "schoolClassForumReactions",
    "schoolClassForumReadStates",
    "schoolClassForumPendingUploads",
  ] as const) {
    expect(
      await t.mutation(internal.auth.cleanup.cleanupDeletedUser, {
        userId: seeded.userId,
      })
    ).toBe(true);
    const rows = await t.query((ctx) => ctx.db.query(table).collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject(
      table === "schoolClassForumPendingUploads"
        ? { uploadedBy: seeded.otherId }
        : { userId: seeded.otherId }
    );
  }
  expect(
    await t.mutation(internal.auth.cleanup.cleanupDeletedUser, {
      userId: seeded.userId,
    })
  ).toBe(false);
  const retained = await t.query(async (ctx) => ({
    forum: await ctx.db.get("schoolClassForums", seeded.forumId),
    post: await ctx.db.get("schoolClassForumPosts", seeded.postId),
    school: await ctx.db.get("schools", seeded.schoolId),
    class: await ctx.db.get("schoolClasses", seeded.classId),
  }));
  expect(retained.forum).toMatchObject({
    reactionCounts: [{ emoji: "👍", count: 1 }],
    postCount: 1,
  });
  expect(retained.post).toMatchObject({
    reactionCounts: [{ emoji: "👍", count: 1 }],
    body: "Retained post",
  });
  expect(retained.school).not.toBeNull();
  expect(retained.class).not.toBeNull();
});
