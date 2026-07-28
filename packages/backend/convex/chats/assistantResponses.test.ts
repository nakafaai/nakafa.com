import posthogTest from "@posthog/convex/test";
import { chatResponseFailureCode } from "@repo/ai/config/generation";
import { getModelCreditCost, ModelIdSchema } from "@repo/ai/config/model";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 3, 2, 12, 0, 0);
const liteModel = ModelIdSchema.make("nakafa-lite");
const liteCreditCost = getModelCreditCost(liteModel);

describe("chats/assistantResponses", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(NOW));
  });

  it("records a reset grant before the usage transaction", async () => {
    const t = convexTest(schema, convexModules);
    posthogTest.register(t);

    const { chatId, userId } = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "chat_user_auth",
        credits: -3,
        creditsResetAt: Date.UTC(2026, 3, 1, 0, 0, 0),
        email: "chat-user@example.com",
        name: "Chat User",
        plan: "free",
      });
      const chatId = await ctx.db.insert("chats", {
        title: "Set 1",
        type: "study",
        updatedAt: NOW,
        userId,
        visibility: "private",
      });

      return { chatId, userId };
    });
    const result = await t.mutation(
      internal.chats.assistantResponses.saveAssistantResponse,
      {
        userId,
        message: {
          chatId,
          identifier: "assistant-1",
          inputTokens: 10,
          modelId: "nakafa-lite",
          outputTokens: 20,
          role: "assistant",
          totalTokens: 30,
        },
        parts: [],
      }
    );
    const state = await t.query(async (ctx) => ({
      creditTransactions: await ctx.db.query("creditTransactions").collect(),
      scheduledJobs: await ctx.db.system
        .query("_scheduled_functions")
        .collect(),
      user: await ctx.db.get("users", userId),
    }));

    expect(result).not.toBeNull();
    if (result === null) {
      return;
    }

    expect(result.credits).toBe(liteCreditCost);
    expect(result.newBalance).toBe(7 - liteCreditCost);
    expect(state.user).toMatchObject({
      credits: 7 - liteCreditCost,
      creditsResetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
    });
    expect(state.creditTransactions).toEqual([
      expect.objectContaining({
        amount: 10,
        balanceAfter: 7,
        type: "daily-grant",
        userId,
      }),
      expect.objectContaining({
        amount: -liteCreditCost,
        balanceAfter: 7 - liteCreditCost,
        metadata: expect.objectContaining({
          chatId,
          inputTokens: 10,
          modelId: "nakafa-lite",
          outputTokens: 20,
          totalTokens: 30,
        }),
        type: "usage",
        userId,
      }),
    ]);
    expect(state.scheduledJobs).toEqual([
      expect.objectContaining({
        args: [
          expect.objectContaining({
            disableGeoip: true,
            distinctId: userId,
            event: "chat response completed",
            properties: JSON.stringify({
              chat_type: "study",
              credits: liteCreditCost,
              input_tokens: 10,
              model_id: "nakafa-lite",
              output_tokens: 20,
              total_tokens: 30,
            }),
          }),
        ],
        name: expect.stringContaining("capture"),
      }),
    ]);
  });

  it("persists a failed response without deducting credits", async () => {
    const t = convexTest(schema, convexModules);
    posthogTest.register(t);

    const { chatId, userId } = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "failed_chat_user_auth",
        credits: 10,
        creditsResetAt: NOW,
        email: "failed-chat-user@example.com",
        name: "Failed Chat User",
        plan: "free",
      });
      const chatId = await ctx.db.insert("chats", {
        title: "Failure",
        type: "study",
        updatedAt: NOW,
        userId,
        visibility: "private",
      });

      return { chatId, userId };
    });
    const result = await t.mutation(
      internal.chats.assistantResponses.saveAssistantFailure,
      {
        userId,
        message: {
          chatId,
          generationErrorCode: chatResponseFailureCode,
          identifier: "assistant-failed",
          modelId: "nakafa-lite",
        },
      }
    );
    const state = await t.query(async (ctx) => ({
      creditTransactions: await ctx.db.query("creditTransactions").collect(),
      messages: await ctx.db.query("messages").collect(),
      scheduledJobs: await ctx.db.system
        .query("_scheduled_functions")
        .collect(),
      user: await ctx.db.get("users", userId),
    }));

    expect(result).not.toBeNull();
    if (result === null) {
      return;
    }

    expect(result.messageId).toBeDefined();
    expect(state.user?.credits).toBe(10);
    expect(state.creditTransactions).toEqual([]);
    expect(state.messages).toEqual([
      expect.objectContaining({
        chatId,
        generationErrorCode: chatResponseFailureCode,
        generationStatus: "failed",
        identifier: "assistant-failed",
        modelId: "nakafa-lite",
        role: "assistant",
      }),
    ]);
    expect(state.scheduledJobs).toEqual([
      expect.objectContaining({
        args: [
          expect.objectContaining({
            disableGeoip: true,
            distinctId: userId,
            event: "chat response failed",
            properties: JSON.stringify({
              chat_type: "study",
              error_code: chatResponseFailureCode,
              model_id: "nakafa-lite",
            }),
          }),
        ],
        name: expect.stringContaining("capture"),
      }),
    ]);
  });

  it("ignores scheduled writes after account deletion starts", async () => {
    const t = convexTest(schema, convexModules);

    const { chatId, userId } = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "deleting-chat-user",
        credits: 10,
        creditsResetAt: NOW,
        deletedAt: NOW,
        email: "deleting-chat-user@example.com",
        name: "Deleting Chat User",
        plan: "free",
      });
      const chatId = await ctx.db.insert("chats", {
        title: "Deleting",
        type: "study",
        updatedAt: NOW,
        userId,
        visibility: "private",
      });

      return { chatId, userId };
    });
    const response = await t.mutation(
      internal.chats.assistantResponses.saveAssistantResponse,
      {
        userId,
        message: {
          chatId,
          identifier: "late-assistant-response",
          modelId: "nakafa-lite",
          role: "assistant",
        },
        parts: [],
      }
    );
    const failure = await t.mutation(
      internal.chats.assistantResponses.saveAssistantFailure,
      {
        userId,
        message: {
          chatId,
          generationErrorCode: chatResponseFailureCode,
          identifier: "late-assistant-failure",
          modelId: "nakafa-lite",
        },
      }
    );
    const state = await t.query(async (ctx) => ({
      messages: await ctx.db.query("messages").collect(),
      scheduledJobs: await ctx.db.system
        .query("_scheduled_functions")
        .collect(),
      user: await ctx.db.get("users", userId),
    }));

    expect(response).toBeNull();
    expect(failure).toBeNull();
    expect(state.messages).toEqual([]);
    expect(state.scheduledJobs).toEqual([]);
    expect(state.user?.credits).toBe(10);
  });

  it("replaces a failed marker when the response succeeds later", async () => {
    const t = convexTest(schema, convexModules);
    posthogTest.register(t);

    const { chatId, userId } = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "retry_chat_user_auth",
        credits: 10,
        creditsResetAt: NOW,
        email: "retry-chat-user@example.com",
        name: "Retry Chat User",
        plan: "free",
      });
      const chatId = await ctx.db.insert("chats", {
        title: "Retry",
        type: "study",
        updatedAt: NOW,
        userId,
        visibility: "private",
      });

      return { chatId, userId };
    });

    await t.mutation(internal.chats.assistantResponses.saveAssistantFailure, {
      userId,
      message: {
        chatId,
        generationErrorCode: chatResponseFailureCode,
        identifier: "assistant-retry",
        modelId: "nakafa-lite",
      },
    });
    await t.mutation(internal.chats.assistantResponses.saveAssistantResponse, {
      userId,
      message: {
        chatId,
        identifier: "assistant-retry",
        inputTokens: 1,
        modelId: "nakafa-lite",
        outputTokens: 2,
        role: "assistant",
        totalTokens: 3,
      },
      parts: [],
    });
    const state = await t.query(async (ctx) => ({
      messages: await ctx.db.query("messages").collect(),
      user: await ctx.db.get("users", userId),
    }));

    expect(state.user?.credits).toBe(10 - liteCreditCost);
    expect(state.messages).toEqual([
      expect.objectContaining({
        chatId,
        generationStatus: "complete",
        identifier: "assistant-retry",
        inputTokens: 1,
        modelId: "nakafa-lite",
        outputTokens: 2,
        role: "assistant",
        totalTokens: 3,
      }),
    ]);
  });
});
