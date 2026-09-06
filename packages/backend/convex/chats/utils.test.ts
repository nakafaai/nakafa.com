import { describe, expect, it } from "@effect/vitest";
import { chatResponseFailureCode } from "@repo/ai/config/generation";
import { defaultModel } from "@repo/ai/config/model";
import type {
  NinaContextSnapshot,
  NinaContextTransition,
} from "@repo/ai/nina/memory/pack";
import { mapDBMessagesToUIMessages } from "@repo/backend/convex/chats/utils";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";

const now = Date.UTC(2026, 5, 6, 0, 0, 0);
const ninaContextSnapshot = {
  capturedAt: "2026-06-06T00:00:00.000Z",
  learning: {
    locale: "en",
    slug: "subjects/mathematics/vector/addition",
    url: "https://nakafa.com/en/subjects/mathematics/vector/addition",
    verified: true,
  },
  source: "current-page",
  tools: {
    allowDeepResearch: true,
    allowMath: true,
    allowNakafa: true,
    allowPageFetch: true,
    evidenceScope: "verified-page",
  },
} satisfies NinaContextSnapshot;
const ninaContextTransition = {
  reason: "page-context",
  toContextKey: "canonical:subjects/mathematics/vector/addition",
} satisfies NinaContextTransition;

describe("mapDBMessagesToUIMessages", () => {
  it("preserves zero usage and text when stored context and model metadata are absent", async () => {
    const t = convexTest(schema, convexModules);
    const messages = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "chat_usage_auth",
        credits: 10,
        creditsResetAt: now,
        email: "chat-usage@example.com",
        name: "Chat Usage",
        plan: "free",
      });
      const chatId = await ctx.db.insert("chats", {
        title: "Partial usage",
        type: "study",
        updatedAt: now,
        userId,
        visibility: "private",
      });
      for (const usage of [
        { identifier: "input-only", inputTokens: 0 },
        { identifier: "output-only", outputTokens: 0 },
        { identifier: "total-only", totalTokens: 0 },
        { identifier: "no-usage" },
      ]) {
        const messageId = await ctx.db.insert("messages", {
          chatId,
          role: "assistant",
          ...usage,
        });
        await ctx.db.insert("messageParts", {
          messageId,
          order: 0,
          textText: usage.identifier,
          type: "text",
        });
      }
      const storedMessages = await ctx.db.query("messages").collect();
      const parts = await ctx.db.query("messageParts").collect();
      return storedMessages.map((message) => ({
        ...message,
        parts: parts.filter((part) => part.messageId === message._id),
      }));
    });

    const hydrated = mapDBMessagesToUIMessages(messages);
    expect(hydrated.map(({ metadata }) => metadata?.tokens)).toEqual([
      { input: 0, output: undefined, total: undefined },
      { input: undefined, output: 0, total: undefined },
      { input: undefined, output: undefined, total: 0 },
      undefined,
    ]);
    for (const message of hydrated) {
      expect(message.metadata).toMatchObject({
        model: defaultModel,
        ninaContextSnapshot: undefined,
        ninaContextTransition: undefined,
      });
      expect(message.parts).toMatchObject([{ text: message.id, type: "text" }]);
    }
  });

  it("preserves persisted assistant generation failure metadata", async () => {
    const t = convexTest(schema, convexModules);

    const messages = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "chat_utils_user_auth",
        email: "chat-utils-user@example.com",
        name: "Chat Utils User",
        plan: "free",
        credits: 10,
        creditsResetAt: now,
      });
      const chatId = await ctx.db.insert("chats", {
        updatedAt: now,
        title: "Failure metadata",
        userId,
        visibility: "private",
        type: "study",
      });
      await ctx.db.insert("messages", {
        chatId,
        role: "assistant",
        identifier: "assistant-failed",
        modelId: "nakafa-lite",
        generationStatus: "failed",
        generationErrorCode: chatResponseFailureCode,
        ninaContextSnapshot,
        ninaContextTransition,
      });

      const messages = await ctx.db.query("messages").collect();
      return messages.map((message) => ({ ...message, parts: [] }));
    });

    const uiMessages = mapDBMessagesToUIMessages(messages);

    expect(uiMessages).toEqual([
      expect.objectContaining({
        id: "assistant-failed",
        metadata: expect.objectContaining({
          model: "nakafa-lite",
          generationStatus: "failed",
          generationErrorCode: chatResponseFailureCode,
          ninaContextSnapshot,
          ninaContextTransition,
        }),
      }),
    ]);
  });
});
