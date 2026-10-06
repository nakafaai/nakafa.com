import { describe, expect, it } from "@effect/vitest";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { Array as Arr } from "effect";

const NOW = Date.UTC(2026, 4, 13, 12, 0, 0);

describe("chats/queries", () => {
  it("allows signed-out viewers to read public chat details", async () => {
    const t = createConvexTestWithBetterAuth();
    const chatId = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, { now: NOW });

      return ctx.db.insert("chats", {
        threadId: "fixture-thread",
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
        threadId: "fixture-thread",
        title: "Public one",
        type: "study",
        updatedAt: NOW + 3,
        userId: user.userId,
        visibility: "public",
      });
      await ctx.db.insert("chats", {
        threadId: "fixture-thread",
        title: "Public two",
        type: "study",
        updatedAt: NOW + 2,
        userId: user.userId,
        visibility: "public",
      });
      await ctx.db.insert("chats", {
        threadId: "fixture-thread",
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
        threadId: "fixture-thread",
        title: "Public",
        type: "study",
        updatedAt: NOW + 2,
        userId: user.userId,
        visibility: "public",
      });
      await ctx.db.insert("chats", {
        threadId: "fixture-thread",
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

    expect(Arr.map(defaultChats.page, (chat) => chat.visibility)).toEqual([
      "public",
    ]);
    expect(Arr.map(ownerChats.page, (chat) => chat.visibility).sort()).toEqual([
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
        threadId: "fixture-thread",
        title: "Private owner chat",
        type: "study",
        updatedAt: NOW + 1,
        userId: owner.userId,
        visibility: "private",
      });
      await ctx.db.insert("chats", {
        threadId: "fixture-thread",
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

it("keeps search and every optional list filter scoped to the right owner and visibility", async () => {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation(async (ctx) => {
    const owner = await seedAuthenticatedUser(ctx, {
      now: NOW,
      suffix: "filter-owner",
    });
    const stranger = await seedAuthenticatedUser(ctx, {
      now: NOW,
      suffix: "filter-stranger",
    });
    for (const userId of [owner.userId, stranger.userId]) {
      for (const visibility of ["public", "private"] as const) {
        await ctx.db.insert("chats", {
          threadId: "fixture-thread",
          title: "Algebra practice",
          userId,
          visibility,
          type: "study",
          updatedAt: NOW,
        });
      }
    }
    return owner;
  });
  const owner = t.withIdentity({
    subject: identity.authUserId,
    sessionId: identity.sessionId,
  });
  const paginationOpts = { cursor: null, numItems: 10 };
  expect(
    (await t.query(api.chats.queries.getOwnChats, { paginationOpts })).page
  ).toEqual([]);
  for (const q of [undefined, " ", "Algebra"]) {
    for (const type of [undefined, "study"] as const) {
      const publicPage = await t.query(api.chats.queries.getChats, {
        userId: identity.userId,
        ...(q === undefined ? {} : { q }),
        ...(type === undefined ? {} : { type }),
        paginationOpts,
      });
      expect(publicPage.page).toEqual([
        expect.objectContaining({
          userId: identity.userId,
          visibility: "public",
        }),
      ]);
      for (const visibility of [undefined, "private", "public"] as const) {
        const ownPage = await owner.query(api.chats.queries.getOwnChats, {
          ...(q === undefined ? {} : { q }),
          ...(type === undefined ? {} : { type }),
          ...(visibility === undefined ? {} : { visibility }),
          paginationOpts,
        });
        expect(ownPage.page).toHaveLength(visibility ? 1 : 2);
        expect(
          Arr.every(
            ownPage.page,
            (chat) =>
              chat.userId === identity.userId &&
              (!visibility || chat.visibility === visibility)
          )
        ).toBe(true);
      }
    }
  }
});

it("protects titles when chats are private, missing, or untitled", async () => {
  const t = createConvexTestWithBetterAuth();
  const fixture = await t.mutation(async (ctx) => {
    const owner = await seedAuthenticatedUser(ctx, { now: NOW });
    const base = {
      userId: owner.userId,
      type: "study" as const,
      updatedAt: NOW,
    };
    const privateId = await ctx.db.insert("chats", {
      threadId: "fixture-thread",
      ...base,
      visibility: "private",
      title: "Secret",
    });
    const publicId = await ctx.db.insert("chats", {
      threadId: "fixture-thread",
      ...base,
      visibility: "public",
      title: "Shared",
    });
    const emptyPublic = await ctx.db.insert("chats", {
      threadId: "fixture-thread",
      ...base,
      visibility: "public",
    });
    const emptyPrivate = await ctx.db.insert("chats", {
      threadId: "fixture-thread",
      ...base,
      visibility: "private",
    });
    const missingId = await ctx.db.insert("chats", {
      threadId: "fixture-thread",
      ...base,
      visibility: "public",
    });
    await ctx.db.delete("chats", missingId);
    return { owner, privateId, publicId, emptyPublic, emptyPrivate, missingId };
  });
  const owner = t.withIdentity({
    subject: fixture.owner.authUserId,
    sessionId: fixture.owner.sessionId,
  });
  expect(
    await t.query(api.chats.queries.getChatTitle, { chatId: fixture.privateId })
  ).toBeNull();
  expect(
    await owner.query(api.chats.queries.getChatTitle, {
      chatId: fixture.privateId,
    })
  ).toBe("Secret");
  expect(
    await t.query(api.chats.queries.getChatTitle, { chatId: fixture.publicId })
  ).toBe("Shared");
  for (const chatId of [
    fixture.emptyPublic,
    fixture.emptyPrivate,
    fixture.missingId,
  ]) {
    expect(
      await owner.query(api.chats.queries.getChatTitle, { chatId })
    ).toBeNull();
  }
  expect(
    await owner.query(api.chats.queries.getChat, { chatId: fixture.privateId })
  ).toMatchObject({ title: "Secret" });
  await expect(
    t.query(api.chats.queries.getChat, { chatId: fixture.missingId })
  ).rejects.toThrow("CHAT_NOT_FOUND");
});
