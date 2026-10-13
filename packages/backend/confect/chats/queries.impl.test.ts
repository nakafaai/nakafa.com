import { Ref } from "@confect/core";
import { assert, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { shareTokenValidator } from "@repo/backend/confect/chats/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { sealedTitle } from "@repo/backend/test/seal";
import { Array as Arr, Order, Schema } from "effect";

const NOW = Date.UTC(2026, 4, 13, 12, 0, 0);
const getChat = Ref.getFunctionReference(refs.public.chats.queries.getChat);
const getShareToken = Ref.getFunctionReference(
  refs.public.chats.queries.getShareToken
);

describe("chats/queries", () => {
  it("lets a signed-out viewer read a shared chat with its token and no other chat", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW })
    );
    const owner = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const chatId = await t.mutation(async (ctx) =>
      ctx.db.insert("chats", {
        threadId: "fixture-thread",
        title: await sealedTitle(ctx, identity.userId, "Shared transcript"),
        type: "study",
        updatedAt: NOW,
        userId: identity.userId,
        visibility: "private",
      })
    );
    await owner.mutation(api.chats.mutations.updateChatVisibility, {
      chatId,
      visibility: "public",
    });
    const shareToken = await owner.query(getShareToken, { chatId });
    assert(shareToken !== null);

    // A reader is told what it takes to show the chat, and not which account
    // owns it. The owner is told that too.
    expect(await t.query(getChat, { chatId, shareToken })).toEqual({
      _creationTime: expect.any(Number),
      _id: chatId,
      threadId: "fixture-thread",
      title: "Shared transcript",
      type: "study",
      updatedAt: NOW,
      visibility: "public",
    });
    expect(await owner.query(getChat, { chatId })).toMatchObject({
      _id: chatId,
      userId: identity.userId,
    });
    await expect(t.query(getChat, { chatId })).rejects.toThrow(
      "CHAT_NOT_FOUND"
    );
  });

  it("lists a learner's own chats, private and shared, and none to another learner", async () => {
    const t = createConvexTestWithBetterAuth();
    const [owner, stranger] = await t.mutation(async (ctx) => {
      const users = await Promise.all([
        seedAuthenticatedUser(ctx, { now: NOW, suffix: "list-owner" }),
        seedAuthenticatedUser(ctx, { now: NOW, suffix: "list-stranger" }),
      ]);
      for (const visibility of ["public", "private"] as const) {
        await ctx.db.insert("chats", {
          threadId: "fixture-thread",
          type: "study",
          updatedAt: NOW,
          userId: users[0].userId,
          visibility,
        });
      }
      return users;
    });
    const asStranger = t.withIdentity({
      sessionId: stranger.sessionId,
      subject: stranger.authUserId,
    });
    const asOwner = t.withIdentity({
      sessionId: owner.sessionId,
      subject: owner.authUserId,
    });
    const paginationOpts = { cursor: null, numItems: 10 };

    expect(
      Arr.sort(
        Arr.map(
          (
            await asOwner.query(api.chats.queries.getOwnChats, {
              paginationOpts,
              type: "study",
            })
          ).page,
          (chat) => chat.visibility
        ),
        Order.String
      )
    ).toEqual(["private", "public"]);
    expect(
      (
        await asStranger.query(api.chats.queries.getOwnChats, {
          paginationOpts,
          type: "study",
        })
      ).page
    ).toEqual([]);
  });

  it("gives the share token to the owner of a shared chat and to nobody else", async () => {
    const t = createConvexTestWithBetterAuth();
    const [owner, stranger] = await t.mutation((ctx) =>
      Promise.all([
        seedAuthenticatedUser(ctx, { now: NOW, suffix: "token-owner" }),
        seedAuthenticatedUser(ctx, { now: NOW, suffix: "token-stranger" }),
      ])
    );
    const asOwner = t.withIdentity({
      sessionId: owner.sessionId,
      subject: owner.authUserId,
    });
    const asStranger = t.withIdentity({
      sessionId: stranger.sessionId,
      subject: stranger.authUserId,
    });
    const chatId = await t.mutation((ctx) =>
      ctx.db.insert("chats", {
        threadId: "fixture-thread",
        type: "study",
        updatedAt: NOW,
        userId: owner.userId,
        visibility: "private",
      })
    );
    const missingId = await t.mutation(async (ctx) => {
      const id = await ctx.db.insert("chats", {
        threadId: "fixture-thread",
        type: "study",
        updatedAt: NOW,
        userId: owner.userId,
        visibility: "private",
      });
      await ctx.db.delete("chats", id);
      return id;
    });
    const tokenOf = (viewer: typeof asOwner, id: typeof chatId) =>
      viewer.query(getShareToken, { chatId: id });

    // A chat that is not shared has no token, for its owner too.
    expect(await tokenOf(asOwner, chatId)).toBeNull();
    await asOwner.mutation(api.chats.mutations.updateChatVisibility, {
      chatId,
      visibility: "public",
    });
    const token = await tokenOf(asOwner, chatId);
    expect(Schema.is(shareTokenValidator)(token)).toBe(true);
    for (const viewer of [t, asStranger]) {
      expect(await tokenOf(viewer, chatId)).toBeNull();
    }
    expect(await tokenOf(asOwner, missingId)).toBeNull();
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
          title: await sealedTitle(ctx, userId, "Algebra practice"),
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

it("gives a title to a chat's owner and never to a chat id alone, shared or private, or for a chat that is missing or untitled", async () => {
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
      title: await sealedTitle(ctx, owner.userId, "Secret"),
    });
    const publicId = await ctx.db.insert("chats", {
      threadId: "fixture-thread",
      ...base,
      visibility: "public",
      title: await sealedTitle(ctx, owner.userId, "Shared"),
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
  ).toBeNull();
  expect(
    await owner.query(api.chats.queries.getChatTitle, {
      chatId: fixture.publicId,
    })
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

it("opens a sealed title with its owner's key for the readers the access rules allow", async () => {
  const t = createConvexTestWithBetterAuth();
  const [owner, stranger] = await t.mutation((ctx) =>
    Promise.all([
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "sealed-owner" }),
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "sealed-stranger" }),
    ])
  );
  const asOwner = t.withIdentity({
    sessionId: owner.sessionId,
    subject: owner.authUserId,
  });
  const asStranger = t.withIdentity({
    sessionId: stranger.sessionId,
    subject: stranger.authUserId,
  });
  const insertChat = () =>
    t.mutation((ctx) =>
      ctx.db.insert("chats", {
        threadId: "fixture-thread",
        type: "study",
        updatedAt: NOW,
        userId: owner.userId,
        visibility: "private",
      })
    );
  const privateId = await insertChat();
  const publicId = await insertChat();
  await asOwner.mutation(api.chats.mutations.updateChatTitle, {
    chatId: privateId,
    title: "Rahasia keluarga",
  });
  await asOwner.mutation(api.chats.mutations.updateChatTitle, {
    chatId: publicId,
    title: "Belajar bersama",
  });
  await asOwner.mutation(api.chats.mutations.updateChatVisibility, {
    chatId: publicId,
    visibility: "public",
  });
  const shareToken = await asOwner.query(getShareToken, { chatId: publicId });
  assert(shareToken !== null);
  // A signed-out viewer reads the shared chat with its token, opened with the
  // owner's key, and gets no title from the chat id alone.
  expect(
    await t.query(getChat, { chatId: publicId, shareToken })
  ).toMatchObject({ title: "Belajar bersama" });
  expect(
    await t.query(api.chats.queries.getChatTitle, { chatId: publicId })
  ).toBeNull();
  // A private title opens for its owner only.
  expect(
    await asOwner.query(api.chats.queries.getChatTitle, { chatId: privateId })
  ).toBe("Rahasia keluarga");
  for (const viewer of [t, asStranger]) {
    expect(
      await viewer.query(api.chats.queries.getChatTitle, { chatId: privateId })
    ).toBeNull();
    await expect(
      viewer.query(api.chats.queries.getChat, { chatId: privateId })
    ).rejects.toThrow("CHAT_NOT_FOUND");
  }
});
