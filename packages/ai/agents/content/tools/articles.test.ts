import { getArticles } from "@repo/ai/agents/content/tools/articles";
import type { MyUIMessage } from "@repo/ai/types/message";
import { getArticleContents } from "@repo/contents/_lib/articles/content";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/contents/_lib/articles/content", () => ({
  getArticleContents: vi.fn(),
}));

/**
 * Creates a test writer that records AI SDK UI message stream parts.
 */
function createWriter() {
  const parts: Parameters<UIMessageStreamWriter<MyUIMessage>["write"]>[0][] =
    [];
  const writer = {
    onError: undefined,
    merge(stream) {
      stream.getReader().releaseLock();
    },
    write(part) {
      parts.push(part);
    },
  } satisfies UIMessageStreamWriter<MyUIMessage>;

  return { parts, writer };
}

describe("content/articles", () => {
  it("fetches articles by category through the contents package", async () => {
    vi.mocked(getArticleContents).mockReturnValue(
      Effect.succeed([
        {
          metadata: {
            title: "Politics",
            authors: [{ name: "Nakafa" }],
            date: "05/08/2026",
          },
          raw: "",
          url: "https://nakafa.com/id/articles/politics/story",
          slug: "articles/politics/story",
          locale: "id",
        },
      ])
    );
    const { parts, writer } = createWriter();

    const output = await Effect.runPromise(
      getArticles({
        input: { locale: "id", category: "politics" },
        toolCallId: "tool-1",
        writer,
      })
    );

    expect(output).toContain("Politics");
    expect(parts.at(-1)).toMatchObject({
      data: {
        baseUrl: "/id/articles/politics",
        status: "done",
        articles: [
          {
            title: "Politics",
            url: "https://nakafa.com/id/articles/politics/story",
            slug: "articles/politics/story",
            locale: "id",
          },
        ],
      },
    });
    expect(getArticleContents).toHaveBeenCalledWith({
      locale: "id",
      basePath: "articles/politics",
      includeMDX: false,
    });
  });
});
