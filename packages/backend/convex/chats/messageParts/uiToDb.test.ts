import type { DataPart } from "@repo/ai/schema/data";
import type { MathToolInput } from "@repo/ai/schema/tools";
import type { MyUIMessage } from "@repo/ai/types/message";
import { mapUIMessagePartsToDBParts } from "@repo/backend/convex/chats/messageParts/uiToDb";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/_lib/agent/schema/read";
import type { ProviderMetadata } from "ai";
import { describe, expect, it } from "vitest";

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
  math: {
    expression: "2x + 3x",
    kind: "math",
    operation: "simplify",
  },
  objective: "Simplify the expression.",
  request: "simplify 2x + 3x",
} satisfies MathToolInput;

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
        data: mathDataFixture(),
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
            ...quranRef,
            from_verse: 1,
            name: "Al-Fatihah",
            revelation: "Mecca",
            to_verse: 1,
            translation: "The Opening",
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
          result: expect.objectContaining({
            work: expect.objectContaining({
              workId: "math:simplify:test",
            }),
          }),
          status: "done",
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

/** Builds a compact MathWork data part for transcript persistence tests. */
function mathDataFixture(): DataPart["math"] {
  return {
    result: {
      artifacts: [],
      steps: [],
      work: {
        assumptions: [],
        computations: [
          {
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
            secondary: {
              expression: "5 * x",
              latex: "5x",
            },
            stepStatus: "complete",
            steps: [],
            status: "verified",
          },
        ],
        createdAt: 1,
        input: {
          givens: ["2x + 3x"],
          kind: "prompt",
          locale: "en",
          objective: "Simplify the expression.",
          text: "simplify 2x + 3x",
        },
        limitations: [],
        plannedRequest: {
          expression: "2 * x + 3 * x",
          kind: "math",
          operation: "simplify",
        },
        primaryResult: {
          expression: "5 * x",
          latex: "5x",
        },
        status: "ready",
        verification: {
          engine: "sympy",
          lane: "verified",
          reasonKey: "math-verification-verified",
          source: "cas.simplify",
          values: [],
        },
        workId: "math:simplify:test",
      },
    },
    status: "done",
  };
}
