import { chatResponseFailureCode } from "@repo/ai/config/generation";
import type {
  NinaContextSnapshot,
  NinaContextTransition,
} from "@repo/ai/nina/memory/pack";
import { mapDBMessagesToUIMessages } from "@repo/backend/convex/chats/utils";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

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
