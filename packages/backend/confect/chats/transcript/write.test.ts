import { describe, expect, it } from "@effect/vitest";
import { MAX_CHAT_MESSAGE_PARTS } from "@repo/backend/confect/chats/constants";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api, internal } from "@repo/backend/convex/_generated/api";

describe("atomic transcript bounds", () => {
  it("persists ordered parts and rolls back an oversized replacement", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: Date.now() })
    );
    const owner = t.withIdentity({
      subject: identity.authUserId,
      sessionId: identity.sessionId,
    });
    const original = await owner.mutation(
      api.chats.mutations.createChatWithMessage,
      {
        type: "study",
        message: { identifier: "start", role: "user" },
        parts: [{ type: "text", textText: "Keep this question", order: 0 }],
      }
    );
    const oversized = Array.from(
      { length: MAX_CHAT_MESSAGE_PARTS + 1 },
      (_, order) => ({
        type: "text" as const,
        textText: "Oversized replacement",
        order,
      })
    );
    await expect(
      owner.mutation(api.chats.mutations.saveMessage, {
        message: { chatId: original.chatId, identifier: "start", role: "user" },
        parts: oversized,
      })
    ).rejects.toMatchObject({ data: { code: "CHAT_PART_LIMIT_EXCEEDED" } });
    const saved = await owner.query(api.chats.queries.loadMessagesPage, {
      chatId: original.chatId,
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(saved.page).toEqual([
      expect.objectContaining({
        _id: original.messageId,
        parts: [
          expect.objectContaining({
            _id: original.partIds[0],
            textText: "Keep this question",
          }),
        ],
      }),
    ]);
  });

  it("rejects an oversized stored rewrite atomically while deletion can resume in bounded pages", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, { now: Date.now() });
      const chatId = await ctx.db.insert("chats", {
        userId: user.userId,
        type: "study",
        visibility: "private",
        updatedAt: Date.now(),
      });
      const messageId = await ctx.db.insert("messages", {
        chatId,
        identifier: "oversized",
        role: "user",
      });
      for (let order = 0; order <= MAX_CHAT_MESSAGE_PARTS; order += 1) {
        await ctx.db.insert("messageParts", {
          messageId,
          type: "text",
          textText: "Stored part",
          order,
        });
      }
      return { user, chatId, messageId };
    });
    const owner = t.withIdentity({
      subject: fixture.user.authUserId,
      sessionId: fixture.user.sessionId,
    });
    await expect(
      owner.mutation(api.chats.mutations.saveMessage, {
        message: {
          chatId: fixture.chatId,
          identifier: "oversized",
          role: "user",
        },
        parts: [],
      })
    ).rejects.toMatchObject({
      data: { code: "CHAT_USER_MESSAGE_REWRITE_EXCEEDED" },
    });
    expect(
      await t.query((ctx) => ctx.db.query("messageParts").collect())
    ).toHaveLength(MAX_CHAT_MESSAGE_PARTS + 1);
    await t.mutation(internal.triggers.chats.cleanup.cleanupDeletedChat, {
      chatId: fixture.chatId,
    });
    expect(
      await t.query((ctx) => ctx.db.get("messages", fixture.messageId))
    ).not.toBeNull();
    expect(
      await t.query((ctx) => ctx.db.query("messageParts").collect())
    ).toHaveLength(1);
    await t.mutation(internal.triggers.chats.cleanup.cleanupDeletedChat, {
      chatId: fixture.chatId,
    });
    expect(
      await t.query((ctx) => ctx.db.get("messages", fixture.messageId))
    ).toBeNull();
    expect(
      await t.query((ctx) => ctx.db.query("messageParts").collect())
    ).toEqual([]);
  });
});
