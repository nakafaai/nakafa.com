import { api } from "@repo/backend/convex/_generated/api";
import type { ninaContextSnapshotValidator } from "@repo/backend/convex/chats/context";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import type { Infer } from "convex/values";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 4, 13, 12, 0, 0);

/** Builds a compact Nina context snapshot for query behavior tests. */
function testNinaContext(
  slug: string
): Infer<typeof ninaContextSnapshotValidator> {
  return {
    capturedAt: new Date(NOW).toISOString(),
    learning: {
      locale: "id",
      slug,
      url: `https://nakafa.com/id/${slug}`,
      verified: true,
    },
    source: "current-page",
    tools: {
      allowDeepResearch: true,
      allowMath: true,
      allowNakafa: true,
      allowPageFetch: true,
      evidenceScope: "verified-page",
    },
  };
}

describe("chats/queries", () => {
  it("allows signed-out viewers to read public chat details", async () => {
    const t = createConvexTestWithBetterAuth();
    const chatId = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, { now: NOW });

      return ctx.db.insert("chats", {
        title: "Public transcript",
        type: "study",
        updatedAt: NOW,
        userId: user.userId,
        visibility: "public",
      });
    });

    const chat = await t.query(api.chats.queries.getChat, { chatId });

    expect(chat).toEqual(
      expect.objectContaining({
        _id: chatId,
        title: "Public transcript",
        visibility: "public",
      })
    );
  });

  it("keeps default chat pagination public when auth resolves", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, { now: NOW });

      await ctx.db.insert("chats", {
        title: "Public one",
        type: "study",
        updatedAt: NOW + 3,
        userId: user.userId,
        visibility: "public",
      });
      await ctx.db.insert("chats", {
        title: "Public two",
        type: "study",
        updatedAt: NOW + 2,
        userId: user.userId,
        visibility: "public",
      });
      await ctx.db.insert("chats", {
        title: "Private one",
        type: "study",
        updatedAt: NOW + 1,
        userId: user.userId,
        visibility: "private",
      });

      return user;
    });

    const firstPage = await t.query(api.chats.queries.getChats, {
      paginationOpts: { cursor: null, numItems: 1 },
      type: "study",
      userId: identity.userId,
    });

    expect(firstPage.isDone).toBe(false);
    expect(firstPage.page).toEqual([
      expect.objectContaining({ visibility: "public" }),
    ]);

    await expect(
      t
        .withIdentity({
          sessionId: identity.sessionId,
          subject: identity.authUserId,
        })
        .query(api.chats.queries.getChats, {
          paginationOpts: {
            cursor: firstPage.continueCursor,
            numItems: 1,
          },
          type: "study",
          userId: identity.userId,
        })
    ).resolves.toEqual(
      expect.objectContaining({
        page: [expect.objectContaining({ visibility: "public" })],
      })
    );
  });

  it("uses a separate owner query before private chats are included", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, { now: NOW });

      await ctx.db.insert("chats", {
        title: "Public",
        type: "study",
        updatedAt: NOW + 2,
        userId: user.userId,
        visibility: "public",
      });
      await ctx.db.insert("chats", {
        title: "Private",
        type: "study",
        updatedAt: NOW + 1,
        userId: user.userId,
        visibility: "private",
      });

      return user;
    });
    const owner = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    const defaultChats = await owner.query(api.chats.queries.getChats, {
      paginationOpts: { cursor: null, numItems: 10 },
      type: "study",
      userId: identity.userId,
    });
    const ownerChats = await owner.query(api.chats.queries.getOwnChats, {
      paginationOpts: { cursor: null, numItems: 10 },
      type: "study",
    });

    expect(defaultChats.page.map((chat) => chat.visibility)).toEqual([
      "public",
    ]);
    expect(ownerChats.page.map((chat) => chat.visibility).sort()).toEqual([
      "private",
      "public",
    ]);
  });

  it("does not expose private chats through public chat lists", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const owner = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "owner",
      });
      const viewer = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "viewer",
      });

      await ctx.db.insert("chats", {
        title: "Private owner chat",
        type: "study",
        updatedAt: NOW + 1,
        userId: owner.userId,
        visibility: "private",
      });
      await ctx.db.insert("chats", {
        title: "Viewer chat",
        type: "study",
        updatedAt: NOW + 2,
        userId: viewer.userId,
        visibility: "private",
      });

      return { owner, viewer };
    });

    const viewer = t.withIdentity({
      sessionId: identity.viewer.sessionId,
      subject: identity.viewer.authUserId,
    });
    const ownerPrivateChats = await viewer.query(api.chats.queries.getChats, {
      paginationOpts: { cursor: null, numItems: 10 },
      type: "study",
      userId: identity.owner.userId,
      visibility: "private",
    });
    const ownChats = await viewer.query(api.chats.queries.getOwnChats, {
      paginationOpts: { cursor: null, numItems: 10 },
      type: "study",
    });

    expect(ownerPrivateChats.page).toEqual([]);
    expect(ownChats.page).toEqual([
      expect.objectContaining({ title: "Viewer chat" }),
    ]);
  });

  it("resolves pinned Nina context from the transcript retained after a rewrite", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "pinned-context",
      });
      const chatId = await ctx.db.insert("chats", {
        title: "Pinned context",
        type: "study",
        updatedAt: NOW,
        userId: user.userId,
        visibility: "private",
      });

      return { chatId, user };
    });
    const owner = t.withIdentity({
      sessionId: identity.user.sessionId,
      subject: identity.user.authUserId,
    });
    const retainedContext = testNinaContext(
      "materi/matematika/integral/jumlahan-riemann"
    );
    const deletedTailContext = testNinaContext(
      "materi/fisika/mekanika/hukum-newton"
    );

    await t.mutation(async (ctx) => {
      await ctx.db.insert("messages", {
        chatId: identity.chatId,
        identifier: "retained-anchor",
        modelId: "nakafa-lite",
        ninaContextSnapshot: retainedContext,
        role: "user",
      });
    });
    await t.mutation(async (ctx) => {
      await ctx.db.insert("messages", {
        chatId: identity.chatId,
        identifier: "rewrite-target",
        modelId: "nakafa-lite",
        role: "user",
      });
    });
    await t.mutation(async (ctx) => {
      await ctx.db.insert("messages", {
        chatId: identity.chatId,
        identifier: "deleted-tail",
        modelId: "nakafa-lite",
        ninaContextSnapshot: deletedTailContext,
        role: "assistant",
      });
    });

    const pinnedForRewrite = await owner.query(
      api.chats.queries.getPinnedNinaContextForTurn,
      {
        chatId: identity.chatId,
        messageIdentifier: "rewrite-target",
      }
    );
    const pinnedForContinuation = await owner.query(
      api.chats.queries.getPinnedNinaContextForTurn,
      {
        chatId: identity.chatId,
        messageIdentifier: "new-message",
      }
    );

    expect(pinnedForRewrite).toEqual(retainedContext);
    expect(pinnedForContinuation).toEqual(deletedTailContext);
  });
});
