import posthogTest from "@posthog/convex/test";
import { chatResponseFailureCode } from "@repo/ai/config/generation";
import { getModelCreditCost, ModelIdSchema } from "@repo/ai/config/model";
import { api, internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE } from "@repo/backend/convex/chats/constants";
import schema from "@repo/backend/convex/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 3, 2, 12, 0, 0);
const liteModel = ModelIdSchema.make("nakafa-lite");
const liteCreditCost = getModelCreditCost(liteModel);

/** Inserts generated tail messages used to exercise bounded transcript rewrites. */
async function insertGeneratedTailMessages(
  ctx: MutationCtx,
  chatId: Id<"chats">,
  count: number
) {
  for (let index = 0; index < count; index += 1) {
    await ctx.db.insert("messages", {
      chatId,
      identifier: `assistant-tail-${index}`,
      modelId: "nakafa-lite",
      role: "assistant",
    });
  }
}

describe("chats/mutations", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(NOW));
  });

  it("records a reset grant before the usage transaction when credits roll into a new window", async () => {
    const t = convexTest(schema, convexModules);
    posthogTest.register(t);

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
          modelId: "nakafa-lite",
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
        },
        parts: [],
      }
    );

    const savedState = await t.query(async (ctx) => ({
      creditTransactions: await ctx.db.query("creditTransactions").collect(),
      scheduledJobs: await ctx.db.system
        .query("_scheduled_functions")
        .collect(),
      user: await ctx.db.get("users", userId),
    }));

    expect(result.credits).toBe(liteCreditCost);
    expect(result.newBalance).toBe(7 - liteCreditCost);
    expect(savedState.user).toMatchObject({
      credits: 7 - liteCreditCost,
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
        amount: -liteCreditCost,
        type: "usage",
        balanceAfter: 7 - liteCreditCost,
        metadata: expect.objectContaining({
          chatId,
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
          modelId: "nakafa-lite",
        }),
      }),
    ]);
    expect(savedState.scheduledJobs).toEqual([
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

  it("persists a failed assistant response without deducting credits", async () => {
    const t = convexTest(schema, convexModules);
    posthogTest.register(t);

    const { chatId, userId } = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "failed_chat_user_auth",
        email: "failed-chat-user@example.com",
        name: "Failed Chat User",
        plan: "free",
        credits: 10,
        creditsResetAt: NOW,
      });
      const chatId = await ctx.db.insert("chats", {
        updatedAt: NOW,
        title: "Failure",
        userId,
        visibility: "private",
        type: "study",
      });

      return { chatId, userId };
    });

    const result = await t.mutation(
      internal.chats.mutations.saveAssistantFailure,
      {
        userId,
        message: {
          chatId,
          identifier: "assistant-failed",
          modelId: "nakafa-lite",
          generationErrorCode: chatResponseFailureCode,
        },
      }
    );

    const savedState = await t.query(async (ctx) => ({
      creditTransactions: await ctx.db.query("creditTransactions").collect(),
      messages: await ctx.db.query("messages").collect(),
      scheduledJobs: await ctx.db.system
        .query("_scheduled_functions")
        .collect(),
      user: await ctx.db.get("users", userId),
    }));

    expect(result.messageId).toBeDefined();
    expect(savedState.user?.credits).toBe(10);
    expect(savedState.creditTransactions).toEqual([]);
    expect(savedState.messages).toEqual([
      expect.objectContaining({
        chatId,
        role: "assistant",
        identifier: "assistant-failed",
        modelId: "nakafa-lite",
        generationStatus: "failed",
        generationErrorCode: chatResponseFailureCode,
      }),
    ]);
    expect(savedState.scheduledJobs).toEqual([
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

  it("replaces a failed assistant marker when the response is saved later", async () => {
    const t = convexTest(schema, convexModules);
    posthogTest.register(t);

    const { chatId, userId } = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "retry_chat_user_auth",
        email: "retry-chat-user@example.com",
        name: "Retry Chat User",
        plan: "free",
        credits: 10,
        creditsResetAt: NOW,
      });
      const chatId = await ctx.db.insert("chats", {
        updatedAt: NOW,
        title: "Retry",
        userId,
        visibility: "private",
        type: "study",
      });

      return { chatId, userId };
    });

    await t.mutation(internal.chats.mutations.saveAssistantFailure, {
      userId,
      message: {
        chatId,
        identifier: "assistant-retry",
        modelId: "nakafa-lite",
        generationErrorCode: chatResponseFailureCode,
      },
    });

    await t.mutation(internal.chats.mutations.saveAssistantResponse, {
      userId,
      message: {
        chatId,
        role: "assistant",
        identifier: "assistant-retry",
        modelId: "nakafa-lite",
        inputTokens: 1,
        outputTokens: 2,
        totalTokens: 3,
      },
      parts: [],
    });

    const savedState = await t.query(async (ctx) => ({
      messages: await ctx.db.query("messages").collect(),
      user: await ctx.db.get("users", userId),
    }));

    expect(savedState.user?.credits).toBe(10 - liteCreditCost);
    expect(savedState.messages).toEqual([
      expect.objectContaining({
        chatId,
        role: "assistant",
        identifier: "assistant-retry",
        modelId: "nakafa-lite",
        generationStatus: "complete",
        inputTokens: 1,
        outputTokens: 2,
        totalTokens: 3,
      }),
    ]);
  });

  it("captures a user chat message with the selected model", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(
      async (ctx) => await seedAuthenticatedUser(ctx, { now: NOW })
    );

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.chats.mutations.createChatWithMessage, {
        type: "study",
        message: {
          role: "user",
          identifier: "user-1",
          modelId: "nakafa-lite",
        },
        parts: [],
      });

    const scheduledJobs = await t.query(
      async (ctx) => await ctx.db.system.query("_scheduled_functions").collect()
    );

    expect(result.chatId).toBeDefined();
    expect(scheduledJobs).toEqual([
      expect.objectContaining({
        args: [
          expect.objectContaining({
            disableGeoip: true,
            distinctId: identity.userId,
            event: "chat message sent",
            properties: JSON.stringify({
              chat_type: "study",
              model_id: "nakafa-lite",
            }),
          }),
        ],
        name: expect.stringContaining("capture"),
      }),
    ]);
  });

  it("atomically replaces an existing user message and its generated tail", async () => {
    const t = createConvexTestWithBetterAuth();
    posthogTest.register(t);
    const identity = await t.mutation(
      async (ctx) =>
        await seedAuthenticatedUser(ctx, {
          now: NOW,
          suffix: "rewrite-owner",
        })
    );
    const owner = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const { chatId } = await owner.mutation(
      api.chats.mutations.createChatWithMessage,
      {
        type: "study",
        message: {
          role: "user",
          identifier: "user-rewrite",
          modelId: "nakafa-lite",
        },
        parts: [],
      }
    );

    await t.mutation(internal.chats.mutations.saveAssistantResponse, {
      userId: identity.userId,
      message: {
        chatId,
        role: "assistant",
        identifier: "assistant-tail",
        modelId: "nakafa-lite",
      },
      parts: [],
    });

    const replacement = await owner.mutation(api.chats.mutations.saveMessage, {
      message: {
        chatId,
        role: "user",
        identifier: "user-rewrite",
        modelId: "nakafa-lite",
      },
      parts: [],
    });
    const messages = await t.query(
      async (ctx) =>
        await ctx.db
          .query("messages")
          .withIndex("by_chatId", (q) => q.eq("chatId", chatId))
          .collect()
    );

    expect(messages).toEqual([
      expect.objectContaining({
        _id: replacement.messageId,
        chatId,
        identifier: "user-rewrite",
        role: "user",
      }),
    ]);
  });

  it("allows transcript rewrites that exactly fill the bounded delete batch", async () => {
    const t = createConvexTestWithBetterAuth();
    posthogTest.register(t);
    const identity = await t.mutation(
      async (ctx) =>
        await seedAuthenticatedUser(ctx, {
          now: NOW,
          suffix: "exact-rewrite-owner",
        })
    );
    const owner = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const { chatId } = await owner.mutation(
      api.chats.mutations.createChatWithMessage,
      {
        type: "study",
        message: {
          role: "user",
          identifier: "user-rewrite-exact",
          modelId: "nakafa-lite",
        },
        parts: [],
      }
    );

    await t.mutation(
      async (ctx) =>
        await insertGeneratedTailMessages(
          ctx,
          chatId,
          CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE - 1
        )
    );

    const replacement = await owner.mutation(api.chats.mutations.saveMessage, {
      message: {
        chatId,
        role: "user",
        identifier: "user-rewrite-exact",
        modelId: "nakafa-lite",
      },
      parts: [],
    });
    const messages = await t.query(
      async (ctx) =>
        await ctx.db
          .query("messages")
          .withIndex("by_chatId", (q) => q.eq("chatId", chatId))
          .collect()
    );

    expect(messages).toEqual([
      expect.objectContaining({
        _id: replacement.messageId,
        chatId,
        identifier: "user-rewrite-exact",
        role: "user",
      }),
    ]);
  });
});
