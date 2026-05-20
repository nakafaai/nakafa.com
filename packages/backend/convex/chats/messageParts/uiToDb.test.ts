import type { MyUIMessage } from "@repo/ai/types/message";
import { mapUIMessagePartsToDBParts } from "@repo/backend/convex/chats/messageParts/uiToDb";
import type { NakafaAgentContentRef } from "@repo/contents/_lib/agent/schema/ref";
import { describe, expect, it } from "vitest";

const ref = {
  content_id: "en/articles/politics/dynastic-politics-asian-values",
  locale: "en",
  markdown_url:
    "https://nakafa.com/en/articles/politics/dynastic-politics-asian-values.md",
  route: "articles/politics/dynastic-politics-asian-values",
  section: "articles",
  url: "https://nakafa.com/en/articles/politics/dynastic-politics-asian-values",
} satisfies NakafaAgentContentRef;

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
  it("persists nakafa tool and data parts without old content fields", () => {
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
          input: { content_ref: ref.url },
          result: {
            ...ref,
            description: "Article summary",
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
            ...ref,
            content_id: "en/quran/1",
            from_verse: 1,
            name: "Al-Fatihah",
            revelation: "Mecca",
            route: "quran/1",
            section: "quran",
            to_verse: 1,
            translation: "The Opening",
            url: "https://nakafa.com/en/quran/1",
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
  });
});
