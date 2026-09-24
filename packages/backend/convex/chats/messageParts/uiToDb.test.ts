import { assert, describe, expect, it } from "@effect/vitest";
import type { MyUIMessage } from "@repo/ai/types/message";
import { mapDBPartToUIMessagePart } from "@repo/backend/convex/chats/messageParts/dbToUi";
import { mapUIMessagePartsToDBParts } from "@repo/backend/convex/chats/messageParts/uiToDb";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { readNakafaContentRefFixture } from "@repo/contents/agent/fixture";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/agent/schema/read";
import {
  type ProviderMetadata,
  readUIMessageStream,
  type UIMessageChunk,
} from "ai";
import { convexTest } from "convex-test";

const ref = readNakafaContentRefFixture(
  "en",
  "articles/politics/dynastic-politics-asian-values",
  "articles"
);
const quranRef = readNakafaContentRefFixture("en", "quran/1", "quran");

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
  given: ["2x + 3x"],
  objective: "Simplify the expression.",
  request: "simplify 2x + 3x",
};

describe("mapUIMessagePartsToDBParts", () => {
  it("persists specialist tool and data parts with optional replay IDs", async () => {
    const parts = [
      {
        type: "tool-nakafa",
        toolCallId: "tool-1",
        state: "output-available",
        callProviderMetadata: toolCallProviderMetadata,
        input: nakafaInput,
        output: "done",
        resultProviderMetadata: toolResultProviderMetadata,
      },
      {
        type: "tool-math",
        toolCallId: "math-tool-1",
        state: "output-available",
        callProviderMetadata: toolCallProviderMetadata,
        input: mathInput,
        output: "verified",
        resultProviderMetadata: toolResultProviderMetadata,
      },
      {
        id: "math-1",
        type: "data-math",
        data: {
          kind: "simplify",
          status: "verified",
          input: {
            expression: "2 * x + 3 * x",
            kind: "math",
            operation: "simplify",
          },
          result: {
            conditions: [],
            input: {
              expression: "2 * x + 3 * x",
              kind: "math",
              operation: "simplify",
            },
            items: [],
            kind: "simplify",
            operation: "simplify",
            primary: {
              expression: "2 * x + 3 * x",
              latex: "2x+3x",
            },
            reason: "The simplify transformation was checked.",
            secondary: {
              expression: "5 * x",
              latex: "5x",
            },
            stepStatus: "complete",
            steps: [
              {
                action: "simplify",
                items: [],
                primary: {
                  expression: "2 * x + 3 * x",
                  latex: "2x+3x",
                },
                relation: {
                  expression: "equals",
                  latex: "=",
                },
                secondary: {
                  expression: "5 * x",
                  latex: "5x",
                },
              },
            ],
            status: "verified",
          },
          summary: "Verified simplification: 5 * x",
        },
      },
      {
        id: "content-1",
        type: "data-nakafa",
        data: {
          kind: "content",
          status: "done",
          input: {
            content_ref: NakafaAgentContentRefInputSchema.make(ref.url),
          },
          result: {
            ...ref,
            title: "Dynastic Politics",
          },
        },
      },
      {
        id: "quran-1",
        type: "data-nakafa",
        data: {
          kind: "quran",
          status: "done",
          input: {
            from_verse: 1,
            include_tafsir: false,
            locale: "en",
            surah: 1,
            to_verse: 1,
          },
          result: {
            ...quranRef,
            from_verse: 1,
            locale: "en",
            meaning: { locale: "en", text: "The Opening" },
            name: "Al-Fatihah",
            revelation: "Mecca",
            to_verse: 1,
            verse_count: 1,
          },
        },
      },
      {
        id: "scrape-1",
        type: "data-scrape-url",
        data: {
          content: "# DevTools",
          description: "Debug and inspect AI SDK applications with DevTools",
          favicon: "https://ai-sdk.dev/favicon.ico",
          status: "done",
          title: "AI SDK Core: DevTools",
          url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
        },
      },
    ] satisfies MyUIMessage["parts"];

    expect(mapUIMessagePartsToDBParts({ messageParts: parts })).toEqual([
      expect.objectContaining({
        type: "tool-nakafa",
        toolCallProviderMetadata,
        toolNakafaInput: nakafaInput,
        toolNakafaOutput: "done",
        toolResultProviderMetadata,
      }),
      expect.objectContaining({
        type: "tool-math",
        toolCallProviderMetadata,
        toolMathInput: mathInput,
        toolMathOutput: "verified",
        toolResultProviderMetadata,
      }),
      expect.objectContaining({
        type: "data-math",
        dataMathData: expect.objectContaining({
          kind: "simplify",
          status: "verified",
        }),
        dataMathId: "math-1",
      }),
      expect.objectContaining({
        type: "data-nakafa",
        dataNakafaData: expect.objectContaining({
          kind: "content",
          status: "done",
        }),
        dataNakafaId: "content-1",
      }),
      expect.objectContaining({
        type: "data-nakafa",
        dataNakafaData: expect.objectContaining({
          kind: "quran",
          input: expect.objectContaining({ include_tafsir: false }),
          status: "done",
        }),
        dataNakafaId: "quran-1",
      }),
      expect.objectContaining({
        type: "data-scrape-url",
        dataScrapeUrlContent: "# DevTools",
        dataScrapeUrlDescription:
          "Debug and inspect AI SDK applications with DevTools",
        dataScrapeUrlFavicon: "https://ai-sdk.dev/favicon.ico",
        dataScrapeUrlId: "scrape-1",
        dataScrapeUrlStatus: "done",
        dataScrapeUrlTitle: "AI SDK Core: DevTools",
        dataScrapeUrlUrl: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
      }),
    ]);
    expect(await roundTrip(parts)).toStrictEqual(parts);
    const withoutIds = parts.map((part) => {
      if (!("id" in part)) {
        return part;
      }
      const { id: _id, ...rest } = part;
      return rest;
    });
    expect(await roundTrip(withoutIds)).toStrictEqual(withoutIds);
  });

  it("persists only string provider metadata needed for replay", () => {
    const providerMetadata = {
      anthropic: {
        cacheControl: { type: "ephemeral" },
        signature: "reasoning-signature",
      },
      gateway: {
        generationId: "gen_123",
        usage: { inputTokens: 120 },
      },
    } satisfies ProviderMetadata;
    const parts = [
      {
        type: "reasoning",
        text: "private reasoning",
        state: "done",
        providerMetadata,
      },
    ] satisfies MyUIMessage["parts"];

    expect(mapUIMessagePartsToDBParts({ messageParts: parts })).toEqual([
      expect.objectContaining({
        type: "reasoning",
        providerMetadata: {
          anthropic: { signature: "reasoning-signature" },
          gateway: { generationId: "gen_123" },
        },
      }),
    ]);
  });
});

/** Persists UI parts in Convex before reconstructing them for replay. */
async function roundTrip(messageParts: MyUIMessage["parts"]) {
  const t = convexTest(schema, convexModules);
  return await t.mutation(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      authId: "round-trip",
      credits: 0,
      creditsResetAt: 0,
      email: "round-trip@example.com",
      name: "Replay",
      plan: "free",
    });
    const chatId = await ctx.db.insert("chats", {
      userId,
      updatedAt: 0,
      visibility: "private",
      type: "study",
    });
    const messageId = await ctx.db.insert("messages", {
      chatId,
      role: "assistant",
      identifier: "replay",
    });
    const results: MyUIMessage["parts"] = [];
    for (const fields of mapUIMessagePartsToDBParts({ messageParts })) {
      const id = await ctx.db.insert("messageParts", { ...fields, messageId });
      const part = await ctx.db.get("messageParts", id);
      assert(part);
      results.push(mapDBPartToUIMessagePart({ part }));
    }
    return results;
  });
}

describe("persisted chat replay", () => {
  it("omits undefined fields created by the SDK's streamed tool updates", async () => {
    const chunks: UIMessageChunk[] = [
      { type: "start", messageId: "sdk" },
      { type: "tool-input-start", toolCallId: "math", toolName: "math" },
      {
        type: "tool-input-available",
        toolCallId: "math",
        toolName: "math",
        input: mathInput,
      },
      { type: "tool-output-available", toolCallId: "math", output: "5x" },
      { type: "finish" },
    ];
    const stream = new ReadableStream<UIMessageChunk>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });
    let parts: MyUIMessage["parts"] = [];
    for await (const message of readUIMessageStream<MyUIMessage>({ stream })) {
      parts = message.parts;
    }
    expect(parts).toHaveLength(1);
    const persisted = mapUIMessagePartsToDBParts({ messageParts: parts });
    expect(persisted).toStrictEqual([
      {
        order: 0,
        type: "tool-math",
        toolToolCallId: "math",
        toolState: "output-available",
        toolMathInput: mathInput,
        toolMathOutput: "5x",
      },
    ]);
    expect(await roundTrip(parts)).toMatchObject(
      parts.map(({ type }) => ({ type }))
    );
  });

  it("preserves text, reasoning, and files with absent optional presentation fields", async () => {
    const parts = [
      { type: "text", text: "Hello" },
      { type: "text", text: "Done", state: "done" },
      { type: "reasoning", text: "Reasoning" },
      {
        type: "file",
        mediaType: "text/plain",
        url: "https://example.com/file",
      },
      {
        type: "file",
        mediaType: "text/plain",
        url: "https://example.com/named",
        filename: "named.txt",
      },
      { type: "step-start" },
      { type: "data-suggestions", data: { data: ["Next question"] } },
      {
        type: "data-suggestions",
        id: "suggestions",
        data: { data: ["Next question"] },
      },
    ] satisfies MyUIMessage["parts"];
    expect(await roundTrip(parts)).toStrictEqual(parts);
  });

  it("replays every specialist state without inventing optional metadata", async () => {
    const researchInput = {
      objective: "Find sources",
      request: "Research",
      sourceRequirements: ["Primary"],
    };
    const tools = [
      { type: "tool-nakafa", input: nakafaInput },
      { type: "tool-deepResearch", input: researchInput },
      { type: "tool-math", input: mathInput },
    ] as const;
    for (const tool of tools) {
      const parts = [
        {
          ...tool,
          state: "input-streaming",
          input: undefined,
          toolCallId: "stream",
        },
        { ...tool, state: "input-available", toolCallId: "input" },
        {
          ...tool,
          state: "output-available",
          output: "Verified",
          toolCallId: "output",
        },
        {
          ...tool,
          state: "output-error",
          errorText: "Unavailable",
          toolCallId: "error",
        },
        {
          ...tool,
          state: "output-error",
          input: undefined,
          errorText: "Invalid arguments",
          toolCallId: "invalid",
        },
      ] satisfies MyUIMessage["parts"];
      expect(await roundTrip(parts)).toEqual(parts);
    }
  });

  it("persists web data both with and without provider metadata or IDs", async () => {
    const parts = [
      {
        type: "data-scrape-url",
        data: {
          url: "https://example.com",
          content: "",
          status: "error",
          error: "Unavailable",
        },
      },
      {
        type: "data-web-search",
        data: { queries: ["query"], sources: [], status: "loading" },
      },
      {
        type: "data-web-search",
        id: "search",
        data: {
          queries: ["query"],
          sources: [],
          status: "error",
          provider: "google",
          error: "Unavailable",
        },
      },
    ] satisfies MyUIMessage["parts"];
    expect(await roundTrip(parts)).toEqual(parts);
  });

  it("rejects unsupported UI parts and approval states before persistence", () => {
    expect(() =>
      mapUIMessagePartsToDBParts({
        messageParts: [
          {
            type: "source-url",
            sourceId: "source",
            url: "https://example.com",
          },
        ],
      })
    ).toThrow("CHAT_PART_TYPE_UNSUPPORTED");
    expect(() =>
      mapUIMessagePartsToDBParts({
        messageParts: [
          {
            type: "tool-math",
            toolCallId: "approval",
            state: "approval-requested",
            approval: { id: "approval" },
            input: mathInput,
          },
        ],
      })
    ).toThrow("CHAT_TOOL_STATE_UNSUPPORTED");
  });
});
