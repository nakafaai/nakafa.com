import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 3, 2, 12, 0, 0);

describe("chats/mutations", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(NOW));
  });

  it("records a reset grant before the usage transaction when credits roll into a new window", async () => {
    const t = convexTest(schema, convexModules);

    const { chatId, userId } = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "chat_user_auth",
        email: "chat-user@example.com",
        name: "Chat User",
        plan: "free",
        credits: -3,
        creditsResetAt: Date.UTC(2026, 3, 1, 0, 0, 0),
      });
      const chatId = await ctx.db.insert("chats", {
        updatedAt: NOW,
        title: "Set 1",
        userId,
        visibility: "private",
        type: "study",
      });

      return { chatId, userId };
    });

    const result = await t.mutation(
      internal.chats.mutations.saveAssistantResponse,
      {
        userId,
        message: {
          chatId,
          role: "assistant",
          identifier: "assistant-1",
          modelId: "gpt-5-nano",
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
        },
        parts: [],
      }
    );

    const savedState = await t.query(async (ctx) => {
      return {
        creditTransactions: await ctx.db.query("creditTransactions").collect(),
        user: await ctx.db.get("users", userId),
      };
    });

    expect(result.credits).toBe(1);
    expect(result.newBalance).toBe(6);
    expect(savedState.user).toMatchObject({
      credits: 6,
      creditsResetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
    });
    expect(savedState.creditTransactions).toEqual([
      expect.objectContaining({
        userId,
        amount: 10,
        type: "daily-grant",
        balanceAfter: 7,
      }),
      expect.objectContaining({
        userId,
        amount: -1,
        type: "usage",
        balanceAfter: 6,
        metadata: expect.objectContaining({
          chatId,
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
          modelId: "gpt-5-nano",
        }),
      }),
    ]);
  });
});
