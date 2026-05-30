import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { afterEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 4, 29, 18, 0, 0);

describe("triggers/comments/comments", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps parent reply counts in sync through comment mutations", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));

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
    vi.setSystemTime(new Date(NOW));

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
