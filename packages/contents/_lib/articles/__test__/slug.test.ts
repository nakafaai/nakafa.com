import { getArticles } from "@repo/contents/_lib/articles/slug";
import { formatISO } from "date-fns";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetContentsMetadata } = vi.hoisted(() => ({
  mockGetContentsMetadata: vi.fn(),
}));

vi.mock("@repo/contents/_data/team", () => ({
  teams: new Set(["Official Author"]),
}));

vi.mock("@repo/contents/_lib/metadata", () => ({
  getContentsMetadata: mockGetContentsMetadata,
}));

beforeEach(() => {
  mockGetContentsMetadata.mockReturnValue(Effect.succeed([]));
});

afterEach(() => {
  vi.clearAllMocks();
  mockGetContentsMetadata.mockReset();
});

describe("getArticles", () => {
  it("returns sorted article summaries using metadata-only listings", async () => {
    mockGetContentsMetadata.mockReturnValue(
      Effect.succeed([
        {
          locale: "en",
          slug: "articles/politics/older-article",
          url: "https://nakafa.com/en/articles/politics/older-article",
          metadata: {
            title: "Older Article",
            description: "Older description",
            authors: [{ name: "Guest Author" }],
            date: new Date("2024-01-02"),
          },
        },
        {
          locale: "en",
          slug: "articles/politics/newer-article",
          url: "https://nakafa.com/en/articles/politics/newer-article",
          metadata: {
            title: "Newer Article",
            description: "Newer description",
            authors: [{ name: "Official Author" }],
            date: new Date("2024-02-02"),
          },
        },
      ])
    );

    const articles = await getArticles("politics", "en");

    expect(mockGetContentsMetadata).toHaveBeenCalledWith({
      locale: "en",
      basePath: "articles/politics",
    });
    expect(articles).toStrictEqual([
      {
        title: "Newer Article",
        description: "Newer description",
        date: formatISO(new Date("2024-02-02")),
        slug: "newer-article",
        official: true,
      },
      {
        title: "Older Article",
        description: "Older description",
        date: formatISO(new Date("2024-01-02")),
        slug: "older-article",
        official: false,
      },
    ]);
  });

  it("deduplicates nested metadata entries by the first article slug segment", async () => {
    mockGetContentsMetadata.mockReturnValue(
      Effect.succeed([
        {
          locale: "en",
          slug: "articles/politics/nested-article",
          url: "https://nakafa.com/en/articles/politics/nested-article",
          metadata: {
            title: "Nested Root",
            description: "Root description",
            authors: [{ name: "Guest Author" }],
            date: new Date("2024-03-01"),
          },
        },
        {
          locale: "en",
          slug: "articles/politics/nested-article/appendix",
          url: "https://nakafa.com/en/articles/politics/nested-article/appendix",
          metadata: {
            title: "Nested Appendix",
            description: "Appendix description",
            authors: [{ name: "Official Author" }],
            date: new Date("2024-03-02"),
          },
        },
      ])
    );

    const articles = await getArticles("politics", "en");

    expect(articles).toHaveLength(1);
    expect(articles[0]?.slug).toBe("nested-article");
    expect(articles[0]?.title).toBe("Nested Root");
  });

  it("accepts a full category path and still resolves the category name", async () => {
    mockGetContentsMetadata.mockReturnValue(Effect.succeed([]));

    const articles = await getArticles("articles/politics" as never, "en");

    expect(mockGetContentsMetadata).toHaveBeenCalledWith({
      locale: "en",
      basePath: "articles/politics",
    });
    expect(articles).toStrictEqual([]);
  });
});
