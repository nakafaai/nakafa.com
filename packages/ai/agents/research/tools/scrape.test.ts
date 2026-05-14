import { scrapeUrl } from "@repo/ai/agents/research/tools/scrape";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const firecrawlApp = vi.hoisted(() => ({
  scrape: vi.fn(),
}));

vi.mock("@repo/ai/config/firecrawl", () => ({
  firecrawlApp,
}));

vi.mock("@repo/ai/lib/selection", () => ({
  selectRelevantContent: ({ content }: { content: string }) => content,
}));

type WrittenPart = Parameters<UIMessageStreamWriter<MyUIMessage>["write"]>[0];

function createWriter() {
  const parts: WrittenPart[] = [];
  const writer = {
    merge: () => undefined,
    onError: undefined,
    write: (part) => {
      parts.push(part);
    },
  } satisfies UIMessageStreamWriter<MyUIMessage>;

  return { parts, writer };
}

describe("research scrape tool", () => {
  beforeEach(() => {
    firecrawlApp.scrape.mockReset();
  });

  it("keeps Firecrawl metadata in tool text and UI data", async () => {
    firecrawlApp.scrape.mockResolvedValue({
      markdown: "# DevTools",
      metadata: {
        description: "Debug and inspect AI SDK applications with DevTools",
        favicon: "https://ai-sdk.dev/favicon.ico",
        title: "AI SDK Core: DevTools",
      },
    });
    const { parts, writer } = createWriter();

    const output = await Effect.runPromise(
      scrapeUrl({
        toolCallId: "scrape-1",
        url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
        writer,
      })
    );

    expect(output).toContain("- Title: AI SDK Core: DevTools");
    expect(output).toContain(
      "- Description: Debug and inspect AI SDK applications with DevTools"
    );
    expect(parts).toEqual([
      expect.objectContaining({
        type: "data-scrape-url",
        data: expect.objectContaining({ status: "loading" }),
      }),
      expect.objectContaining({
        type: "data-scrape-url",
        data: expect.objectContaining({
          content: "# DevTools",
          description: "Debug and inspect AI SDK applications with DevTools",
          favicon: "https://ai-sdk.dev/favicon.ico",
          status: "done",
          title: "AI SDK Core: DevTools",
        }),
      }),
    ]);
  });

  it("falls back to alternate metadata fields when markdown is missing", async () => {
    firecrawlApp.scrape.mockResolvedValue({
      metadata: {
        dcDescription: "Fallback description",
        ogTitle: "Fallback title",
      },
    });
    const { parts, writer } = createWriter();

    const output = await Effect.runPromise(
      scrapeUrl({
        toolCallId: "scrape-2",
        url: "https://example.com/missing-markdown",
        writer,
      })
    );

    expect(output).toContain("- Title: Fallback title");
    expect(output).toContain("- Description: Fallback description");
    expect(output).toContain("- Error: No content found.");
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        type: "data-scrape-url",
        data: expect.objectContaining({
          description: "Fallback description",
          error: "No content found.",
          status: "error",
          title: "Fallback title",
        }),
      })
    );
  });

  it("keeps scrape output valid when metadata is unavailable", async () => {
    firecrawlApp.scrape.mockResolvedValue({
      markdown: "# Plain source",
    });
    const { parts, writer } = createWriter();

    const output = await Effect.runPromise(
      scrapeUrl({
        toolCallId: "scrape-no-metadata",
        url: "https://example.com/plain",
        writer,
      })
    );

    expect(output).not.toContain("- Title:");
    expect(output).not.toContain("- Description:");
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        type: "data-scrape-url",
        data: {
          content: "# Plain source",
          status: "done",
          url: "https://example.com/plain",
        },
      })
    );
  });

  it("writes an error part when Firecrawl scrape fails", async () => {
    firecrawlApp.scrape.mockRejectedValue(new Error("offline"));
    const { parts, writer } = createWriter();

    const output = await Effect.runPromise(
      scrapeUrl({
        toolCallId: "scrape-3",
        url: "https://example.com/offline",
        writer,
      })
    );

    expect(output).toContain("Failed to crawl");
    expect(output).not.toContain("- Title:");
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        type: "data-scrape-url",
        data: expect.objectContaining({ status: "error" }),
      })
    );
  });
});
