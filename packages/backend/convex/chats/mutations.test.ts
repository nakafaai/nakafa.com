import posthogTest from "@posthog/convex/test";
import { getModelCreditCost } from "@repo/ai/config/models";
import { api, internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 3, 2, 12, 0, 0);
const liteCreditCost = getModelCreditCost("nakafa-lite");

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
            host: "https://eu.i.posthog.com",
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
});
