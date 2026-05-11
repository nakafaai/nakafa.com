import { mapDBPartToUIMessagePart } from "@repo/backend/convex/chats/messageParts/dbToUi";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import type { NakafaAgentContentRef } from "@repo/contents/_lib/agent/schema/ref";
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
        type: "tool-math",
        toolToolCallId: "math-tool-1",
        toolState: "output-available",
        toolMathInput: "compare x + 1 and x + 2",
        toolMathOutput: "contradicted",
      });
      await ctx.db.insert("parts", {
        messageId,
        order: 2,
        type: "data-math",
        dataMathId: "math-1",
        dataMathData: {
          kind: "compare",
          status: "contradicted",
          input: {
            kind: "math",
            left: "x + 1",
            operation: "compare",
            right: "x + 2",
          },
          result: {
            conditions: [],
            input: {
              kind: "math",
              left: "x + 1",
              operation: "compare",
              right: "x + 2",
            },
            items: [
              {
                label: "counterexample",
                latex: "\\left\\{ x : -3\\right\\}",
                value: "{x: -3}",
              },
            ],
            kind: "compare",
            operation: "compare",
            primary: {
              expression: "x + 1",
              latex: "x+1",
            },
            reason: "A deterministic numeric counterexample was found.",
            secondary: {
              expression: "x + 2",
              latex: "x+2",
            },
            stepStatus: "partial",
            steps: [
              {
                action: "compare",
                items: [],
                primary: {
                  expression: "x + 1",
                  latex: "x+1",
                },
                relation: {
                  expression: "not equal",
                  latex: "\\not=",
                },
                secondary: {
                  expression: "x + 2",
                  latex: "x+2",
                },
              },
            ],
            status: "contradicted",
          },
          summary: "A deterministic numeric counterexample was found.",
        },
      });
      await ctx.db.insert("parts", {
        messageId,
        order: 3,
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
        order: 4,
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
      await ctx.db.insert("parts", {
        messageId,
        order: 5,
        type: "data-math",
        dataMathId: "previous-math-1",
        dataMathData: {
          input: { expression: "2 + 2" },
          kind: "evaluate",
          result: {
            input: { expression: "2 + 2", latex: "2+2" },
            output: { expression: "4", latex: "4", value: "4" },
          },
          status: "verified",
          summary: "2 + 2 = 4",
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
        type: "tool-math",
        input: { query: "compare x + 1 and x + 2" },
        output: "contradicted",
      }),
      expect.objectContaining({
        type: "data-math",
        id: "math-1",
        data: expect.objectContaining({
          kind: "compare",
          status: "contradicted",
        }),
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
      expect.objectContaining({
        type: "data-math",
        id: "previous-math-1",
        data: expect.objectContaining({
          input: expect.objectContaining({ kind: "math" }),
          kind: "evaluate",
          status: "verified",
        }),
      }),
    ]);
  });
});
