import { getArticles, getSlugPath } from "@repo/contents/_lib/articles/slug";
import { formatContentDateISO } from "@repo/contents/_shared/date";
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
  it("builds the canonical detail path for a real article category and slug", () => {
    expect(getSlugPath("politics", "nepotism-in-political-governance")).toBe(
      "/articles/politics/nepotism-in-political-governance"
    );
  });

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
            date: "01/02/2024",
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
            date: "02/02/2024",
          },
        },
      ])
    );

    const articles = await getArticles("politics", "en");

    expect(mockGetContentsMetadata).toHaveBeenCalledWith({
      locale: "en",
      basePath: "articles/politics/",
    });
    expect(articles).toStrictEqual([
      {
        title: "Newer Article",
        description: "Newer description",
        date: formatContentDateISO("02/02/2024"),
        slug: "newer-article",
        official: true,
      },
      {
        title: "Older Article",
        description: "Older description",
        date: formatContentDateISO("01/02/2024"),
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
            date: "03/01/2024",
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
            date: "03/02/2024",
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
      basePath: "articles/politics/",
    });
    expect(articles).toStrictEqual([]);
  });

  it("returns an empty list for malformed full category paths", async () => {
    const articles = await getArticles("articles/" as never, "en");

    expect(mockGetContentsMetadata).not.toHaveBeenCalled();
    expect(articles).toStrictEqual([]);
  });

  it("ignores entries from categories that only share the same prefix", async () => {
    mockGetContentsMetadata.mockReturnValue(
      Effect.succeed([
        {
          locale: "en",
          slug: "articles/politics/valid-article",
          url: "https://nakafa.com/en/articles/politics/valid-article",
          metadata: {
            title: "Valid Article",
            description: "Valid description",
            authors: [{ name: "Guest Author" }],
            date: "04/01/2024",
          },
        },
        {
          locale: "en",
          slug: "articles/politics-extra/should-not-leak",
          url: "https://nakafa.com/en/articles/politics-extra/should-not-leak",
          metadata: {
            title: "Wrong Category",
            description: "Wrong description",
            authors: [{ name: "Official Author" }],
            date: "04/02/2024",
          },
        },
      ])
    );

    const articles = await getArticles("politics", "en");

    expect(articles).toHaveLength(1);
    expect(articles[0]?.slug).toBe("valid-article");
  });

  it("skips entries with invalid dates instead of failing the whole list", async () => {
    mockGetContentsMetadata.mockReturnValue(
      Effect.succeed([
        {
          locale: "en",
          slug: "articles/politics/valid-article",
          url: "https://nakafa.com/en/articles/politics/valid-article",
          metadata: {
            title: "Valid Article",
            description: "Valid description",
            authors: [{ name: "Official Author" }],
            date: "04/01/2024",
          },
        },
        {
          locale: "en",
          slug: "articles/politics/bad-date-article",
          url: "https://nakafa.com/en/articles/politics/bad-date-article",
          metadata: {
            title: "Bad Date",
            description: "Broken description",
            authors: [{ name: "Guest Author" }],
            date: "not-a-real-date",
          },
        },
      ])
    );

    const articles = await getArticles("politics", "en");

    expect(articles).toHaveLength(1);
    expect(articles[0]?.slug).toBe("valid-article");
    expect(articles[0]?.official).toBe(true);
  });

  it("defaults missing descriptions to an empty string", async () => {
    mockGetContentsMetadata.mockReturnValue(
      Effect.succeed([
        {
          locale: "en",
          slug: "articles/politics/no-description",
          url: "https://nakafa.com/en/articles/politics/no-description",
          metadata: {
            title: "No Description",
            authors: [{ name: "Guest Author" }],
            date: "05/01/2024",
          },
        },
      ])
    );

    const articles = await getArticles("politics", "en");

    expect(articles).toHaveLength(1);
    expect(articles[0]).toMatchObject({
      slug: "no-description",
      description: "",
    });
  });
});
