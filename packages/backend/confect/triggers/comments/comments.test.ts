import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { Array as Arr } from "effect";

const NOW = Date.UTC(2026, 4, 29, 18, 0, 0);

describe("triggers/comments/comments", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("drains full vote and reply batches after a parent is deleted", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const t = createConvexTestWithBetterAuth();
    const author = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW })
    );
    const client = t.withIdentity({
      subject: author.authUserId,
      sessionId: author.sessionId,
    });
    const slug = "en/articles/politics/cleanup";
    const parentId = await client.mutation(api.comments.mutations.addComment, {
      slug,
      text: "Parent",
    });
    await t.mutation(async (ctx) => {
      for (let index = 0; index < 100; index += 1) {
        const userId = await ctx.db.insert("users", {
          authId: `voter-${index}`,
          credits: 0,
          creditsResetAt: NOW,
          email: `voter-${index}@example.com`,
          name: `Voter ${index}`,
          plan: "free",
        });
        await ctx.db.insert("commentVotes", {
          commentId: parentId,
          userId,
          vote: 1,
        });
        await ctx.db.insert("comments", {
          slug,
          userId,
          text: `Reply ${index}`,
          parentId,
          replyToUserId: author.userId,
          replyToText: "Parent",
          upvoteCount: 0,
          downvoteCount: 0,
          replyCount: 0,
        });
      }
      await ctx.db.patch("comments", parentId, {
        upvoteCount: 100,
        replyCount: 100,
      });
    });
    await client.mutation(api.comments.mutations.deleteComment, {
      commentId: parentId,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 150);
    const state = await t.query(async (ctx) => ({
      comments: await ctx.db.query("comments").collect(),
      votes: await ctx.db.query("commentVotes").collect(),
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
    expect(state.comments).toEqual([]);
    expect(state.votes).toEqual([]);
    expect(Arr.every(state.jobs, (job) => job.state.kind === "success")).toBe(
      true
    );
    expect(
      Arr.filter(state.jobs, (job) => job.args[0].commentId === parentId)
    ).toHaveLength(3);
  });

  it("keeps parent reply counts in sync through comment mutations", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const t = createConvexTestWithBetterAuth();
    const users = await t.mutation(async (ctx) => ({
      author: await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "comment-author",
      }),
      replier: await seedAuthenticatedUser(ctx, {
        now: NOW,
        sessionToken: "session-comment-replier",
        suffix: "comment-replier",
      }),
    }));
    const author = t.withIdentity({
      sessionId: users.author.sessionId,
      subject: users.author.authUserId,
    });
    const replier = t.withIdentity({
      sessionId: users.replier.sessionId,
      subject: users.replier.authUserId,
    });

    const parentId = await author.mutation(api.comments.mutations.addComment, {
      slug: "/en/articles/politics/example",
      text: "Parent comment",
    });
    const replyId = await replier.mutation(api.comments.mutations.addComment, {
      slug: "en/articles/politics/example",
      text: "Reply comment",
      parentId,
    });

    const replyState = await t.query(async (ctx) => ({
      parent: await ctx.db.get("comments", parentId),
      reply: await ctx.db.get("comments", replyId),
    }));

    expect(replyState.parent).toMatchObject({ replyCount: 1 });
    expect(replyState.reply).toMatchObject({
      parentId,
      replyToText: "Parent comment",
      replyToUserId: users.author.userId,
    });

    await replier.mutation(api.comments.mutations.deleteComment, {
      commentId: replyId,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const deleteState = await t.query(async (ctx) => ({
      parent: await ctx.db.get("comments", parentId),
      reply: await ctx.db.get("comments", replyId),
    }));

    expect(deleteState.parent).toMatchObject({ replyCount: 0 });
    expect(deleteState.reply).toBeNull();
  });

  it("tolerates deleting a reply after its parent was removed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const t = createConvexTestWithBetterAuth();
    const users = await t.mutation(async (ctx) => ({
      author: await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "deleted-parent-author",
      }),
      replier: await seedAuthenticatedUser(ctx, {
        now: NOW,
        sessionToken: "session-deleted-parent-replier",
        suffix: "deleted-parent-replier",
      }),
    }));
    const author = t.withIdentity({
      sessionId: users.author.sessionId,
      subject: users.author.authUserId,
    });
    const replier = t.withIdentity({
      sessionId: users.replier.sessionId,
      subject: users.replier.authUserId,
    });

    const parentId = await author.mutation(api.comments.mutations.addComment, {
      slug: "/en/articles/politics/deleted-parent",
      text: "Parent before delete",
    });
    const replyId = await replier.mutation(api.comments.mutations.addComment, {
      slug: "/en/articles/politics/deleted-parent",
      text: "Reply after parent delete",
      parentId,
    });

    await author.mutation(api.comments.mutations.deleteComment, {
      commentId: parentId,
    });
    await replier.mutation(api.comments.mutations.deleteComment, {
      commentId: replyId,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const state = await t.query(async (ctx) => ({
      parent: await ctx.db.get("comments", parentId),
      reply: await ctx.db.get("comments", replyId),
    }));

    expect(state.parent).toBeNull();
    expect(state.reply).toBeNull();
  });
});
