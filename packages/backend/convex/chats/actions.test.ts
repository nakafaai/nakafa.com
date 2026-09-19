import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { chatResponseFailureCode } from "@repo/ai/config/generation";
import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";

describe("durable assistant scheduling", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each(["complete", "failed"] as const)(
    "authenticates and durably settles a %s held response",
    async (status) => {
      const t = createConvexTestWithBetterAuth();
      const identity = await t.mutation(async (ctx) => {
        const user = await seedAuthenticatedUser(ctx, { now: Date.now() });
        const chatId = await ctx.db.insert("chats", {
          userId: user.userId,
          type: "study",
          visibility: "private",
          updatedAt: Date.now(),
        });
        return { ...user, chatId };
      });
      const owner = t.withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      });
      const turnId = await owner.mutation(api.chats.turns.mutations.reserve, {
        modelId: "nakafa-lite",
      });
      const message = {
        chatId: identity.chatId,
        identifier: "scheduled-answer",
        modelId: "nakafa-lite" as const,
      };
      if (status === "complete") {
        await expect(
          t.action(api.chats.actions.scheduleSaveAssistantResponse, {
            turnId,
            message: { ...message, role: "assistant" },
            parts: [],
          })
        ).rejects.toThrow();
        await owner.action(api.chats.actions.scheduleSaveAssistantResponse, {
          turnId,
          message: { ...message, role: "assistant" },
          parts: [],
        });
      } else {
        await expect(
          t.action(api.chats.actions.scheduleSaveAssistantFailure, {
            turnId,
            message: {
              ...message,
              generationErrorCode: chatResponseFailureCode,
            },
          })
        ).rejects.toThrow();
        await owner.action(api.chats.actions.scheduleSaveAssistantFailure, {
          turnId,
          message: { ...message, generationErrorCode: chatResponseFailureCode },
        });
      }
      await vi.advanceTimersByTimeAsync(1);
      await t.finishInProgressScheduledFunctions();
      const result = await t.query(async (ctx) => ({
        messages: await ctx.db.query("messages").collect(),
        hold: await ctx.db.get("chatTurns", turnId),
        user: await ctx.db.get("users", identity.userId),
      }));
      expect(result.messages).toEqual([
        expect.objectContaining({
          identifier: "scheduled-answer",
          generationStatus: status,
        }),
      ]);
      expect(result.hold).toBeNull();
      expect(result.user?.credits).toBe(status === "complete" ? 8 : 10);
      await t.finishAllScheduledFunctions(vi.runAllTimers);
    }
  );
});
