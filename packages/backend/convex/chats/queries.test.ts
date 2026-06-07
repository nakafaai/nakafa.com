import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 4, 13, 12, 0, 0);

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
});
