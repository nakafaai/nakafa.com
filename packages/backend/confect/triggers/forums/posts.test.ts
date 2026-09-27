import { afterEach, describe, expect, it } from "@effect/vitest";
import { forumPostsBySequence } from "@repo/backend/confect/classes/forums/aggregate";
import {
  insertClass,
  insertClassMembership,
  insertSchool,
  insertSchoolMembership,
} from "@repo/backend/confect/classes/test.helpers";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api, internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";

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

  it("keeps reply relationships, mentions, and forum counters atomic", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const author = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "forum-reply-author",
      });
      const replier = await seedAuthenticatedUser(ctx, {
        now: NOW,
        sessionToken: "session-forum-reply-replier",
        suffix: "forum-reply-replier",
      });
      const mentioned = await seedAuthenticatedUser(ctx, {
        now: NOW,
        sessionToken: "session-forum-reply-mentioned",
        suffix: "forum-reply-mentioned",
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
        body: "Replies body",
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
        title: "Replies forum",
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

    const state = await t.query(async (ctx) => ({
      parent: await ctx.db.get("schoolClassForumPosts", parentPostId),
      reply: await ctx.db.get("schoolClassForumPosts", replyPostId),
      forum: await ctx.db.get("schoolClassForums", seeded.forumId),
    }));
    expect(state.parent).toMatchObject({ replyCount: 1 });
    expect(state.reply).toMatchObject({
      parentId: parentPostId,
      replyToUserId: seeded.author.userId,
      replyToBody: "Parent post",
      mentions: [seeded.mentioned.userId],
    });
    expect(state.forum).toMatchObject({
      postCount: 2,
      lastPostBy: seeded.replier.userId,
    });

    let more = true;
    for (let pass = 0; more && pass < 20; pass += 1) {
      more = await t.mutation(internal.auth.cleanup.cleanupDeletedUser, {
        userId: seeded.replier.userId,
      });
    }
    expect(more).toBe(false);
    const afterReply = await t.query((ctx) =>
      loadForumPostState(ctx, {
        forumId: seeded.forumId,
        parentPostId,
        userId: seeded.author.userId,
      })
    );
    expect(afterReply.aggregateCount).toBe(1);
    expect(afterReply.parentPost).toMatchObject({ replyCount: 0 });
    expect(afterReply.forum).toMatchObject({
      postCount: 1,
      lastPostBy: seeded.author.userId,
    });
    expect(await t.query((ctx) => ctx.db.get(replyPostId))).toBeNull();

    for (let pass = 0; pass < 20; pass += 1) {
      await t.mutation(internal.auth.cleanup.cleanupDeletedUser, {
        userId: seeded.author.userId,
      });
      if (!(await t.query((ctx) => ctx.db.get(parentPostId)))) {
        break;
      }
    }
    const empty = await t.query((ctx) =>
      loadForumPostState(ctx, {
        forumId: seeded.forumId,
        parentPostId,
        userId: seeded.author.userId,
      })
    );
    expect(empty.aggregateCount).toBe(0);
    expect(empty.parentPost).toBeNull();
    expect(empty.forum).toMatchObject({
      postCount: 0,
      lastPostBy: seeded.author.userId,
    });
    expect(empty.forum?.lastPostAt).toBe(empty.forum?._creationTime);
  });
  it("cleans a deleted forum's parent and replies without leaving aggregate rows", async () => {
    vi.setSystemTime(new Date(NOW));
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(seedOpenForum);
    const owner = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const parentId = await owner.mutation(
      api.classes.forums.mutations.posts.createForumPost,
      { body: "Parent post", forumId: identity.forumId }
    );
    await owner.mutation(api.classes.forums.mutations.posts.createForumPost, {
      body: "Reply post",
      forumId: identity.forumId,
      parentId,
    });
    await t.mutation((ctx) =>
      ctx.db.delete("schoolClassForums", identity.forumId)
    );
    let more = true;
    for (let pass = 0; more && pass < 20; pass += 1) {
      more = await t.mutation(internal.auth.cleanup.cleanupDeletedUser, {
        userId: identity.userId,
      });
    }
    expect(more).toBe(false);
    await expect(
      t.query((ctx) => ctx.db.query("schoolClassForumPosts").collect())
    ).resolves.toEqual([]);
    await expect(
      t.query((ctx) =>
        forumPostsBySequence.count(ctx, { namespace: identity.forumId })
      )
    ).resolves.toBe(0);
  });
});
