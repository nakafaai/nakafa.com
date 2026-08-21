// @vitest-environment node

import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/rss.xml/route";

const mockReadActiveContentIdentity = vi.hoisted(() => vi.fn());
const mockReadPublishedLatestArticles = vi.hoisted(() => vi.fn());
const mockReadPublishedLatestMaterials = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/article/discovery", () => ({
  readPublishedLatestArticles: mockReadPublishedLatestArticles,
}));
vi.mock("@/lib/content/material/discovery", () => ({
  readPublishedLatestMaterials: mockReadPublishedLatestMaterials,
}));
vi.mock("@/lib/content/published/active", () => ({
  readActiveContentIdentity: mockReadActiveContentIdentity,
}));
vi.mock("next-intl/server", () => ({
  getTranslations: ({ namespace }: { namespace: string }) =>
    Promise.resolve((key: string) => `${namespace}.${key}`),
}));

const activeReleaseId = "release-material";

beforeEach(() => {
  mockReadActiveContentIdentity
    .mockReset()
    .mockReturnValue(Effect.succeed({ releaseId: activeReleaseId }));
  mockReadPublishedLatestArticles.mockReset().mockReturnValue(
    Effect.succeed({
      articles: [
        {
          authors: [{ name: "Nakafa" }],
          category: "politics",
          categoryTitle: "Politics",
          date: "2026-07-24",
          description: "Published description",
          official: true,
          publicPath: "articles/politics/published",
          slug: "published",
          title: "Published article",
        },
      ],
    })
  );
  mockReadPublishedLatestMaterials.mockReset().mockReturnValue(
    Effect.succeed({
      activeReleaseId,
      materials: [],
    })
  );
});

describe("rss route", () => {
  it("serves dated signed articles and materials as RSS XML", async () => {
    mockReadPublishedLatestMaterials.mockReturnValue(
      Effect.succeed({
        activeReleaseId,
        materials: [
          {
            authors: [{ name: "Nabil Akbarazzima Fatih" }],
            date: "2025-04-27",
            description: "Understand functions as input-output relationships.",
            publicPath:
              "subjects/mathematics/function-composition-inverse-function/function-concept",
            sourcePath:
              "packages/corpus/material/lesson/mathematics/function-composition-inverse-function/function-concept/en.mdx",
            title: "Function Concept",
          },
          {
            authors: [{ name: "Nakafa" }],
            date: "2025-04-26",
            description: undefined,
            publicPath: "subjects/mathematics/functions/identity",
            sourcePath:
              "packages/corpus/material/lesson/mathematics/functions/identity/en.mdx",
            title: "Identity Function",
          },
        ],
      })
    );

    const response = await GET();
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain(
      "application/rss+xml"
    );
    expect(text).toContain("<rss");
    expect(text).toContain("<![CDATA[Published article]]>");
    expect(text).toContain("<![CDATA[Function Concept]]>");
    expect(text).toContain("<![CDATA[Identity Function]]>");
    expect(text).toContain(
      "<description><![CDATA[Identity Function]]></description>"
    );
    expect(mockReadPublishedLatestArticles).toHaveBeenCalledWith("en", 100);
    expect(mockReadPublishedLatestArticles).toHaveBeenCalledWith("id", 100);
  });

  it("omits an empty signed article catalog", async () => {
    mockReadPublishedLatestArticles.mockReturnValue(
      Effect.succeed({ articles: [] })
    );

    const text = await (await GET()).text();

    expect(text).not.toContain("Published article");
  });

  it("rejects the feed when no active publication exists", async () => {
    mockReadActiveContentIdentity.mockReturnValueOnce(Effect.succeed(null));

    await expect(GET()).rejects.toThrow();
    expect(mockReadPublishedLatestMaterials).not.toHaveBeenCalled();
  });

  it("rejects the feed when the active publication disappears", async () => {
    mockReadActiveContentIdentity
      .mockReturnValueOnce(Effect.succeed({ releaseId: activeReleaseId }))
      .mockReturnValueOnce(Effect.succeed(null));

    await expect(GET()).rejects.toMatchObject({
      _tag: "PublishedReleaseMismatchError",
      actualReleaseId: null,
      expectedReleaseId: activeReleaseId,
    });
  });

  it("rejects a feed assembled across different active releases", async () => {
    mockReadPublishedLatestMaterials.mockReturnValue(
      Effect.succeed({ activeReleaseId: "release-a", materials: [] })
    );
    mockReadActiveContentIdentity
      .mockReturnValue(Effect.succeed({ releaseId: "release-a" }))
      .mockReturnValueOnce(Effect.succeed({ releaseId: "release-a" }))
      .mockReturnValueOnce(Effect.succeed({ releaseId: "release-b" }));

    await expect(GET()).rejects.toMatchObject({
      _tag: "PublishedReleaseMismatchError",
      actualReleaseId: "release-b",
      expectedReleaseId: "release-a",
    });
  });
});
