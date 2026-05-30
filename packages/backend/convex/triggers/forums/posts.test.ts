import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { forumPostsBySequence } from "@repo/backend/convex/classes/forums/aggregate";
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
import { afterEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 4, 29, 14, 0, 0);

/** Seeds one open class forum with a signed-in teacher owner. */
async function seedOpenForum(ctx: MutationCtx) {
  const user = await seedAuthenticatedUser(ctx, {
    now: NOW,
    suffix: "forum-post-trigger",
  });
  const schoolId = await insertSchool(ctx, {
    now: NOW,
    userId: user.userId,
  });
  const classId = await insertClass(ctx, {
    now: NOW,
    schoolId,
    userId: user.userId,
  });

  await insertSchoolMembership(ctx, {
    now: NOW,
    role: "teacher",
    schoolId,
    userId: user.userId,
  });
  await insertClassMembership(ctx, {
    now: NOW,
    role: "teacher",
    classId,
    schoolId,
    userId: user.userId,
  });

  const forumId = await ctx.db.insert("schoolClassForums", {
    body: "Trigger contract body",
    classId,
    createdBy: user.userId,
    isPinned: false,
    lastPostAt: NOW,
    lastPostBy: user.userId,
    nextPostSequence: 1,
    postCount: 0,
    reactionCounts: [],
    schoolId,
    status: "open",
    tag: "general",
    title: "Trigger contract",
    updatedAt: NOW,
  });

  return { ...user, classId, forumId };
}

async function loadForumPostState(
  ctx: QueryCtx,
  {
    forumId,
    parentPostId,
    userId,
  }: {
    forumId: Id<"schoolClassForums">;
    parentPostId: Id<"schoolClassForumPosts">;
    userId: Id<"users">;
  }
) {
  return {
    aggregateCount: await forumPostsBySequence.count(ctx, {
      namespace: forumId,
    }),
    forum: await ctx.db.get("schoolClassForums", forumId),
    parentPost: await ctx.db.get("schoolClassForumPosts", parentPostId),
    readState: await ctx.db
      .query("schoolClassForumReadStates")
      .withIndex("by_forumId_and_userId", (q) =>
        q.eq("forumId", forumId).eq("userId", userId)
      )
      .unique(),
  };
}

describe("triggers/forums/posts", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs forum post triggers through the native trigger-aware mutation", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(seedOpenForum);
    const owner = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    const parentPostId = await owner.mutation(
      api.classes.forums.mutations.posts.createForumPost,
      {
        body: "First post",
        forumId: identity.forumId,
      }
    );
    await owner.mutation(api.classes.forums.mutations.posts.createForumPost, {
      body: "Reply post",
      forumId: identity.forumId,
      parentId: parentPostId,
    });

    const state = await t.query(async (ctx) =>
      loadForumPostState(ctx, {
        forumId: identity.forumId,
        parentPostId,
        userId: identity.userId,
      })
    );

    expect(state.aggregateCount).toBe(2);
    expect(state.forum).toMatchObject({
      lastPostBy: identity.userId,
      nextPostSequence: 3,
      postCount: 2,
    });
    expect(state.parentPost).toMatchObject({
      replyCount: 1,
      sequence: 1,
    });
    expect(state.readState).toMatchObject({
      classId: identity.classId,
      lastReadSequence: 2,
      userId: identity.userId,
    });
  });

  it("creates reply and mention notifications through forum post triggers", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const author = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "forum-notification-author",
      });
      const replier = await seedAuthenticatedUser(ctx, {
        now: NOW,
        sessionToken: "session-forum-notification-replier",
        suffix: "forum-notification-replier",
      });
      const mentioned = await seedAuthenticatedUser(ctx, {
        now: NOW,
        sessionToken: "session-forum-notification-mentioned",
        suffix: "forum-notification-mentioned",
      });
      const schoolId = await insertSchool(ctx, {
        now: NOW,
        userId: author.userId,
      });
      const classId = await insertClass(ctx, {
        now: NOW,
        schoolId,
        userId: author.userId,
      });

      for (const userId of [author.userId, replier.userId, mentioned.userId]) {
        await insertSchoolMembership(ctx, {
          now: NOW,
          role: userId === author.userId ? "teacher" : "student",
          schoolId,
          userId,
        });
        await insertClassMembership(ctx, {
          now: NOW,
          role: userId === author.userId ? "teacher" : "student",
          classId,
          schoolId,
          userId,
        });
      }

      const forumId = await ctx.db.insert("schoolClassForums", {
        body: "Notifications body",
        classId,
        createdBy: author.userId,
        isPinned: false,
        lastPostAt: NOW,
        lastPostBy: author.userId,
        nextPostSequence: 1,
        postCount: 0,
        reactionCounts: [],
        schoolId,
        status: "open",
        tag: "general",
        title: "Notifications forum",
        updatedAt: NOW,
      });

      return { author, classId, forumId, mentioned, replier };
    });
    const author = t.withIdentity({
      sessionId: seeded.author.sessionId,
      subject: seeded.author.authUserId,
    });
    const replier = t.withIdentity({
      sessionId: seeded.replier.sessionId,
      subject: seeded.replier.authUserId,
    });

    const parentPostId = await author.mutation(
      api.classes.forums.mutations.posts.createForumPost,
      {
        body: "Parent post",
        forumId: seeded.forumId,
      }
    );
    const replyPostId = await replier.mutation(
      api.classes.forums.mutations.posts.createForumPost,
      {
        body: "Reply with a mention",
        forumId: seeded.forumId,
        mentions: [seeded.mentioned.userId],
        parentId: parentPostId,
      }
    );

    const state = await t.query(async (ctx) => {
      const [authorNotifications, mentionedNotifications] = await Promise.all([
        ctx.db
          .query("notifications")
          .withIndex("by_recipientId", (q) =>
            q.eq("recipientId", seeded.author.userId)
          )
          .collect(),
        ctx.db
          .query("notifications")
          .withIndex("by_recipientId", (q) =>
            q.eq("recipientId", seeded.mentioned.userId)
          )
          .collect(),
      ]);

      const [authorCount, mentionedCount] = await Promise.all([
        ctx.db
          .query("notificationCounts")
          .withIndex("by_userId", (q) => q.eq("userId", seeded.author.userId))
          .unique(),
        ctx.db
          .query("notificationCounts")
          .withIndex("by_userId", (q) =>
            q.eq("userId", seeded.mentioned.userId)
          )
          .unique(),
      ]);

      return {
        authorCount,
        authorNotifications,
        mentionedCount,
        mentionedNotifications,
      };
    });

    expect(state.authorNotifications).toEqual([
      expect.objectContaining({
        actorId: seeded.replier.userId,
        entityId: replyPostId,
        entityType: "schoolClassForumPosts",
        previewBody: "Reply with a mention",
        previewTitle: "Notifications forum",
        recipientId: seeded.author.userId,
        type: "post_reply",
      }),
    ]);
    expect(state.mentionedNotifications).toEqual([
      expect.objectContaining({
        actorId: seeded.replier.userId,
        entityId: replyPostId,
        entityType: "schoolClassForumPosts",
        previewBody: "Reply with a mention",
        previewTitle: "Notifications forum",
        recipientId: seeded.mentioned.userId,
        type: "post_mention",
      }),
    ]);
    expect(state.authorCount).toMatchObject({ unreadCount: 1 });
    expect(state.mentionedCount).toMatchObject({ unreadCount: 1 });
  });
});
