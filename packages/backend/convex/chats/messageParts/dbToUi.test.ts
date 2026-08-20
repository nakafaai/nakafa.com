import { mapDBPartToUIMessagePart } from "@repo/backend/convex/chats/messageParts/dbToUi";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/_lib/agent/schema/read";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const now = Date.UTC(2026, 4, 8, 0, 0, 0);
const ref = readNakafaContentRefFixture(
  "en",
  "articles/politics/dynastic-politics-asian-values",
  "articles"
);

const toolCallProviderMetadata = {
  google: { thoughtSignature: "call-signature" },
};

const toolResultProviderMetadata = {
  google: { thoughtSignature: "result-signature" },
};

const nakafaInput = {
  deliverables: ["current page evidence"],
  objective: "Read the current Nakafa page.",
  request: "current page",
  requirements: ["Use the current page URL."],
};

const mathInput = {
  given: ["x + 1", "x + 2"],
  objective: "Compare the expressions.",
  request: "compare x + 1 and x + 2",
};

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

      await ctx.db.insert("messageParts", {
        messageId,
        order: 0,
        type: "tool-nakafa",
        toolToolCallId: "tool-1",
        toolState: "output-available",
        toolCallProviderMetadata,
        toolNakafaInput: nakafaInput,
        toolNakafaOutput: "done",
        toolResultProviderMetadata,
      });
      await ctx.db.insert("messageParts", {
        messageId,
        order: 1,
        type: "tool-math",
        toolToolCallId: "math-tool-1",
        toolState: "output-available",
        toolCallProviderMetadata,
        toolMathInput: mathInput,
        toolMathOutput: "contradicted",
        toolResultProviderMetadata,
      });
      await ctx.db.insert("messageParts", {
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
      await ctx.db.insert("messageParts", {
        messageId,
        order: 3,
        type: "data-nakafa",
        dataNakafaId: "content-1",
        dataNakafaData: {
          kind: "content",
          status: "done",
          input: {
            content_ref: NakafaAgentContentRefInputSchema.make(ref.url),
          },
          result: {
            ...ref,
            description: "Article summary",
            title: "Dynastic Politics",
          },
        },
      });
      await ctx.db.insert("messageParts", {
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
      await ctx.db.insert("messageParts", {
        messageId,
        order: 5,
        type: "data-nakafa",
        dataNakafaId: "search-1",
        dataNakafaData: {
          kind: "search",
          status: "done",
          input: {
            limit: 5,
            locale: "en",
            offset: 0,
            queries: ["politics"],
          },
          result: {
            count: 1,
            has_more: false,
            items: [
              {
                ...ref,
                description: "Article summary",
                excerpt: "Article summary",
                title: "Dynastic Politics",
              },
            ],
            limit: 5,
            offset: 0,
          },
        },
      });
      await ctx.db.insert("messageParts", {
        messageId,
        order: 6,
        type: "data-scrape-url",
        dataScrapeUrlId: "scrape-1",
        dataScrapeUrlUrl: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
        dataScrapeUrlContent: "# DevTools",
        dataScrapeUrlTitle: "AI SDK Core: DevTools",
        dataScrapeUrlDescription:
          "Debug and inspect AI SDK applications with DevTools",
        dataScrapeUrlFavicon: "https://ai-sdk.dev/favicon.ico",
        dataScrapeUrlStatus: "done",
      });
      return await ctx.db
        .query("messageParts")
        .withIndex("by_messageId_and_order", (q) =>
          q.eq("messageId", messageId)
        )
        .collect();
    });

    expect(parts.map((part) => mapDBPartToUIMessagePart({ part }))).toEqual([
      expect.objectContaining({
        type: "tool-nakafa",
        callProviderMetadata: toolCallProviderMetadata,
        input: nakafaInput,
        output: "done",
        resultProviderMetadata: toolResultProviderMetadata,
      }),
      expect.objectContaining({
        type: "tool-math",
        callProviderMetadata: toolCallProviderMetadata,
        input: mathInput,
        output: "contradicted",
        resultProviderMetadata: toolResultProviderMetadata,
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
        type: "data-nakafa",
        id: "search-1",
        data: expect.objectContaining({
          kind: "search",
          result: expect.objectContaining({
            items: [
              expect.objectContaining({
                excerpt: "Article summary",
              }),
            ],
          }),
          status: "done",
        }),
      }),
      expect.objectContaining({
        type: "data-scrape-url",
        id: "scrape-1",
        data: expect.objectContaining({
          content: "# DevTools",
          description: "Debug and inspect AI SDK applications with DevTools",
          favicon: "https://ai-sdk.dev/favicon.ico",
          status: "done",
          title: "AI SDK Core: DevTools",
          url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
        }),
      }),
    ]);
  });
});
