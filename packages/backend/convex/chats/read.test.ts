import { api } from "@repo/backend/convex/_generated/api";
import { MAX_CHAT_MESSAGE_PARTS } from "@repo/backend/convex/chats/constants";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 4, 29, 12, 0, 0);

function getConvexErrorData(error: unknown) {
  if (typeof error !== "object" || error === null || !("data" in error)) {
    throw new Error("Expected a ConvexError with data.");
  }

  return error.data;
}

describe("chats/read", () => {
  it("hydrates each message with parts in persisted order", async () => {
    const t = createConvexTestWithBetterAuth();
    const chatId = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, { now: NOW });
      const chatId = await ctx.db.insert("chats", {
        title: "Transcript",
        type: "study",
        updatedAt: NOW,
        userId: user.userId,
        visibility: "public",
      });
      const messageId = await ctx.db.insert("messages", {
        chatId,
        identifier: "assistant-1",
        role: "assistant",
      });

      await ctx.db.insert("messageParts", {
        messageId,
        order: 2,
        textText: "Second",
        type: "text",
      });
      await ctx.db.insert("messageParts", {
        messageId,
        order: 1,
        textText: "First",
        type: "text",
      });

      return chatId;
    });

    const transcript = await t.query(api.chats.queries.loadMessagesPage, {
      chatId,
      paginationOpts: { cursor: null, numItems: 10 },
    });

    expect(transcript.page).toHaveLength(1);

    const message = transcript.page[0];
    if (!message) {
      throw new Error("Expected one hydrated message.");
    }

    expect(message.parts.map((part) => part.order)).toEqual([1, 2]);
    expect(message.parts.map((part) => part.textText)).toEqual([
      "First",
      "Second",
    ]);
  });

  it("rejects messages that exceed the supported part load limit", async () => {
    const t = createConvexTestWithBetterAuth();
    const chatId = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, { now: NOW });
      const chatId = await ctx.db.insert("chats", {
        title: "Oversized transcript",
        type: "study",
        updatedAt: NOW,
        userId: user.userId,
        visibility: "public",
      });
      const messageId = await ctx.db.insert("messages", {
        chatId,
        identifier: "assistant-oversized",
        role: "assistant",
      });

      for (let order = 0; order <= MAX_CHAT_MESSAGE_PARTS; order += 1) {
        await ctx.db.insert("messageParts", {
          messageId,
          order,
          textText: `Part ${order}`,
          type: "text",
        });
      }

      return chatId;
    });

    let thrown: unknown;
    try {
      await t.query(api.chats.queries.loadMessagesPage, {
        chatId,
        paginationOpts: { cursor: null, numItems: 10 },
      });
    } catch (error) {
      thrown = error;
    }

    expect(getConvexErrorData(thrown)).toEqual({
      code: "CHAT_MESSAGE_PART_LIMIT_EXCEEDED",
      message: "Chat message part count exceeds the supported load limit.",
    });
  });
});
