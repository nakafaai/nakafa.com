import { chatResponseFailureCode } from "@repo/ai/config/generation";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 5, 7, 0, 0, 0);

describe("chats/maintenance", () => {
  it("repairs incomplete assistant messages and refunds charged credits", async () => {
    const t = convexTest(schema, convexModules);

    const seed = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "maintenance_user_auth",
        email: "maintenance@example.com",
        name: "Maintenance User",
        plan: "free",
        credits: 3,
        creditsResetAt: NOW,
      });
      const chatId = await ctx.db.insert("chats", {
        updatedAt: NOW,
        title: "Incomplete",
        userId,
        visibility: "private",
        type: "study",
      });
      const messageId = await ctx.db.insert("messages", {
        chatId,
        role: "assistant",
        identifier: "assistant-incomplete",
        modelId: "nakafa-lite",
        credits: 2,
      });

      await ctx.db.insert("parts", {
        messageId,
        order: 0,
        type: "reasoning",
        reasoningText: "Masih streaming.",
        reasoningState: "streaming",
      });
      await ctx.db.insert("parts", {
        messageId,
        order: 1,
        type: "data-suggestions",
        dataSuggestionsId: "suggestions",
        dataSuggestionsData: ["Apa contoh lain?"],
      });

      return { chatId, messageId, userId };
    });

    const result = await t.mutation(
      internal.chats.maintenance.repairIncompleteAssistantResponses,
      {
        paginationOpts: { cursor: null, numItems: 10 },
      }
    );
    const repairedState = await t.query(async (ctx) => ({
      creditTransactions: await ctx.db.query("creditTransactions").collect(),
      message: await ctx.db.get(seed.messageId),
      parts: await ctx.db.query("parts").collect(),
      user: await ctx.db.get(seed.userId),
    }));

    expect(result).toEqual({
      continueCursor: expect.any(String),
      isDone: true,
      refundedCredits: 2,
      repaired: 1,
      scanned: 1,
    });
    expect(repairedState.user?.credits).toBe(5);
    expect(repairedState.parts).toEqual([]);
    expect(repairedState.message).toMatchObject({
      credits: 0,
      generationStatus: "failed",
      generationErrorCode: chatResponseFailureCode,
    });
    expect(repairedState.creditTransactions).toEqual([
      expect.objectContaining({
        userId: seed.userId,
        amount: 2,
        type: "refund",
        balanceAfter: 5,
        metadata: expect.objectContaining({
          chatId: seed.chatId,
          messageId: seed.messageId,
          modelId: "nakafa-lite",
          reason: "incomplete-assistant-response",
        }),
      }),
    ]);
  });

  it("keeps complete assistant messages unchanged", async () => {
    const t = convexTest(schema, convexModules);

    const seed = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "complete_user_auth",
        email: "complete@example.com",
        name: "Complete User",
        plan: "free",
        credits: 3,
        creditsResetAt: NOW,
      });
      const chatId = await ctx.db.insert("chats", {
        updatedAt: NOW,
        title: "Complete",
        userId,
        visibility: "private",
        type: "study",
      });
      const messageId = await ctx.db.insert("messages", {
        chatId,
        role: "assistant",
        identifier: "assistant-complete",
        modelId: "nakafa-lite",
        credits: 2,
        generationStatus: "complete",
      });

      await ctx.db.insert("parts", {
        messageId,
        order: 0,
        type: "text",
        textText: "Jawaban final.",
        textState: "done",
      });

      return { messageId, userId };
    });

    const result = await t.mutation(
      internal.chats.maintenance.repairIncompleteAssistantResponses,
      {
        paginationOpts: { cursor: null, numItems: 10 },
      }
    );
    const completeState = await t.query(async (ctx) => ({
      creditTransactions: await ctx.db.query("creditTransactions").collect(),
      message: await ctx.db.get(seed.messageId),
      parts: await ctx.db.query("parts").collect(),
      user: await ctx.db.get(seed.userId),
    }));

    expect(result).toEqual({
      continueCursor: expect.any(String),
      isDone: true,
      refundedCredits: 0,
      repaired: 0,
      scanned: 1,
    });
    expect(completeState.user?.credits).toBe(3);
    expect(completeState.creditTransactions).toEqual([]);
    expect(completeState.message).toMatchObject({
      credits: 2,
      generationStatus: "complete",
    });
    expect(completeState.parts).toHaveLength(1);
  });
});
