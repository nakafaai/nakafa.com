import { mapDBPartToUIMessagePart } from "@repo/backend/convex/chats/messageParts/dbToUi";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import type { NakafaAgentContentRef } from "@repo/contents/_lib/agent/schemas";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const now = Date.UTC(2026, 4, 8, 0, 0, 0);
const ref = {
  content_id: "en/articles/politics/dynastic-politics-asian-values",
  locale: "en",
  markdown_url:
    "https://nakafa.com/en/articles/politics/dynastic-politics-asian-values.md",
  route: "articles/politics/dynastic-politics-asian-values",
  section: "articles",
  url: "https://nakafa.com/en/articles/politics/dynastic-politics-asian-values",
} satisfies NakafaAgentContentRef;

describe("mapDBPartToUIMessagePart", () => {
  it("hydrates nakafa tool and data parts from the current schema", async () => {
    const t = convexTest(schema, convexModules);

    const parts = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "chat_part_user_auth",
        email: "chat-part-user@example.com",
        name: "Chat Part User",
        plan: "free",
        credits: 10,
        creditsResetAt: now,
      });
      const chatId = await ctx.db.insert("chats", {
        updatedAt: now,
        title: "Mapper",
        userId,
        visibility: "private",
        type: "study",
      });
      const messageId = await ctx.db.insert("messages", {
        chatId,
        role: "assistant",
        identifier: "assistant-1",
      });

      await ctx.db.insert("parts", {
        messageId,
        order: 0,
        type: "tool-nakafa",
        toolToolCallId: "tool-1",
        toolState: "output-available",
        toolNakafaInput: "current page",
        toolNakafaOutput: "done",
      });
      await ctx.db.insert("parts", {
        messageId,
        order: 1,
        type: "data-nakafa",
        dataNakafaId: "content-1",
        dataNakafaData: {
          kind: "content",
          status: "done",
          input: { content_ref: ref.url },
          result: {
            ...ref,
            description: "Article summary",
            title: "Dynastic Politics",
          },
        },
      });
      await ctx.db.insert("parts", {
        messageId,
        order: 2,
        type: "data-nakafa",
        dataNakafaId: "taxonomy-1",
        dataNakafaData: {
          kind: "taxonomy",
          status: "done",
          input: { locale: "en" },
          result: {
            content_counts: [{ count: 1, locale: "en" }],
            locale: "en",
            sections: ["articles", "quran"],
            tools: ["nakafa_search_content", "nakafa_get_content"],
          },
        },
      });

      return await ctx.db
        .query("parts")
        .withIndex("by_messageId_and_order", (q) =>
          q.eq("messageId", messageId)
        )
        .collect();
    });

    expect(parts.map((part) => mapDBPartToUIMessagePart({ part }))).toEqual([
      expect.objectContaining({
        type: "tool-nakafa",
        input: { query: "current page" },
        output: "done",
      }),
      expect.objectContaining({
        type: "data-nakafa",
        id: "content-1",
        data: expect.objectContaining({
          kind: "content",
          status: "done",
        }),
      }),
      expect.objectContaining({
        type: "data-nakafa",
        id: "taxonomy-1",
        data: expect.objectContaining({
          kind: "taxonomy",
          status: "done",
        }),
      }),
    ]);
  });
});
