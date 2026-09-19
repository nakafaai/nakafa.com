import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { assert, beforeEach, describe, expect, it } from "@effect/vitest";
import posthogTest from "@posthog/convex/test";
import { chatResponseFailureCode } from "@repo/ai/config/generation";
import { getModelCreditCost, ModelIdSchema } from "@repo/ai/config/model";
import { api, internal } from "@repo/backend/convex/_generated/api";
import { CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE } from "@repo/backend/convex/chats/constants";
import { reserveChatTurn } from "@repo/backend/convex/chats/turns/impl";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import {
  createConvexTestWithBetterAuth,
  seedAnalyticsConsent,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";

const NOW = Date.UTC(2026, 3, 2, 12, 0, 0);
const liteModel = ModelIdSchema.make("nakafa-lite");
const liteCreditCost = getModelCreditCost(liteModel);

describe("chats/assistantResponses", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(NOW));
  });

  it("records a reset grant before the usage transaction", async () => {
    const t = convexTest(schema, convexModules);
    rateLimiterTest.register(t, "agentRateLimiter");
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
      await seedAnalyticsConsent(ctx, { decidedAt: NOW, userId });
      const chatId = await ctx.db.insert("chats", {
        title: "Set 1",
        type: "study",
        updatedAt: NOW,
        userId,
        visibility: "private",
      });

      return { chatId, userId };
    });
    const turnId = await t.mutation(async (ctx) => {
      const user = await ctx.db.get("users", userId);
      assert(user);
      return runConvexProgram(reserveChatTurn(ctx, user, liteModel));
    });
    const result = await t.mutation(
      internal.chats.assistantResponses.saveAssistantResponse,
      {
        userId,
        turnId,
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
    expect(
      state.scheduledJobs.filter(({ name }) => name.includes("capture"))
    ).toEqual([
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

  it("persists a failed response and refunds its reserved credits", async () => {
    const t = convexTest(schema, convexModules);
    rateLimiterTest.register(t, "agentRateLimiter");
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
      await seedAnalyticsConsent(ctx, { decidedAt: NOW, userId });
      const chatId = await ctx.db.insert("chats", {
        title: "Failure",
        type: "study",
        updatedAt: NOW,
        userId,
        visibility: "private",
      });

      return { chatId, userId };
    });
    const turnId = await t.mutation(async (ctx) => {
      const user = await ctx.db.get("users", userId);
      assert(user);
      return runConvexProgram(reserveChatTurn(ctx, user, liteModel));
    });
    const result = await t.mutation(
      internal.chats.assistantResponses.saveAssistantFailure,
      {
        userId,
        turnId,
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
    expect(
      state.creditTransactions.map(({ type, amount }) => [type, amount])
    ).toEqual([
      ["usage", -liteCreditCost],
      ["refund", liteCreditCost],
    ]);
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
    expect(
      state.scheduledJobs.filter(({ name }) => name.includes("capture"))
    ).toEqual([
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

  it("ignores scheduled writes while account deletion is prepared", async () => {
    const t = convexTest(schema, convexModules);
    rateLimiterTest.register(t, "agentRateLimiter");

    const { chatId, userId } = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "deleting-chat-user",
        credits: 10,
        creditsResetAt: NOW,
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
    const turnId = await t.mutation(async (ctx) => {
      const user = await ctx.db.get("users", userId);
      assert(user);
      return runConvexProgram(reserveChatTurn(ctx, user, liteModel));
    });
    await t.mutation((ctx) =>
      ctx.db.patch("users", userId, { deletionPreparedAt: NOW })
    );
    const response = await t.mutation(
      internal.chats.assistantResponses.saveAssistantResponse,
      {
        userId,
        turnId,
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
        turnId,
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
    expect(state.scheduledJobs).toEqual([
      expect.objectContaining({ name: expect.stringContaining("expire") }),
    ]);
    expect(state.user?.credits).toBe(10 - liteCreditCost);
  });

  it("replaces a failed marker when the response succeeds later", async () => {
    const t = convexTest(schema, convexModules);
    rateLimiterTest.register(t, "agentRateLimiter");
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

    const turnId = await t.mutation(async (ctx) => {
      const user = await ctx.db.get("users", userId);
      assert(user);
      return runConvexProgram(reserveChatTurn(ctx, user, liteModel));
    });
    await t.mutation(internal.chats.assistantResponses.saveAssistantFailure, {
      userId,
      turnId,
      message: {
        chatId,
        generationErrorCode: chatResponseFailureCode,
        identifier: "assistant-retry",
        modelId: "nakafa-lite",
      },
    });
    const retryTurnId = await t.mutation(async (ctx) => {
      const user = await ctx.db.get("users", userId);
      assert(user);
      return runConvexProgram(reserveChatTurn(ctx, user, liteModel));
    });
    await t.mutation(internal.chats.assistantResponses.saveAssistantResponse, {
      userId,
      turnId: retryTurnId,
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

  it("preserves the transcript and reservation when a rewrite exceeds its transaction bound", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, credits: 10 })
    );
    const owner = t.withIdentity({
      subject: identity.authUserId,
      sessionId: identity.sessionId,
    });
    const chatId = await owner.mutation(api.chats.mutations.createChat, {
      type: "study",
    });
    const turnId = await owner.mutation(api.chats.turns.mutations.reserve, {
      modelId: "nakafa-lite",
    });
    await t.mutation(async (ctx) => {
      for (
        let index = 0;
        index <= CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE;
        index += 1
      ) {
        await ctx.db.insert("messages", {
          chatId,
          identifier: `answer-${index}`,
          role: "assistant",
          modelId: "nakafa-lite",
        });
      }
    });

    await expect(
      t.mutation(internal.chats.assistantResponses.saveAssistantResponse, {
        userId: identity.userId,
        turnId,
        message: {
          chatId,
          identifier: "answer-0",
          role: "assistant",
          modelId: "nakafa-lite",
        },
        parts: [],
      })
    ).rejects.toMatchObject({
      data: { code: "CHAT_ASSISTANT_RESPONSE_REWRITE_EXCEEDED" },
    });
    const state = await t.query(async (ctx) => ({
      messages: await ctx.db.query("messages").collect(),
      turn: await ctx.db.get("chatTurns", turnId),
      user: await ctx.db.get("users", identity.userId),
      ledger: await ctx.db.query("creditTransactions").collect(),
    }));
    expect(state.messages).toHaveLength(
      CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE + 1
    );
    expect(state.turn).toMatchObject({ _id: turnId });
    expect(state.user?.credits).toBe(10 - liteCreditCost);
    expect(state.ledger).toEqual([
      expect.objectContaining({
        type: "usage",
        metadata: { modelId: "nakafa-lite", phase: "reserved" },
      }),
    ]);
  });
});
