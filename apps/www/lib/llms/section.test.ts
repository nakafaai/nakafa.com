// @vitest-environment node

import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BASE_URL } from "@/lib/llms/constants";
import type { LlmsEntry } from "@/lib/llms/entries";
import {
  buildLlmsListingIndexText,
  buildLlmsPageIndexText,
  buildLlmsSectionPageMapText,
  getLlmsSectionPages,
} from "@/lib/llms/section";

const mockGetRuntimeContentRouteCounts = vi.hoisted(() => vi.fn());
const mockReadPublishedArticleBuckets = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/article/sitemap", () => ({
  readPublishedArticleBuckets: mockReadPublishedArticleBuckets,
}));

vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimeContentRouteCounts: mockGetRuntimeContentRouteCounts,
}));

const articleEntry: LlmsEntry = {
  description: "Verified description",
  href: `${BASE_URL}/en/articles/politics/article.md`,
  route: "/articles/politics/article",
  section: "articles",
  segments: ["articles", "politics", "article"],
  title: "Verified article",
};

beforeEach(() => {
  mockGetRuntimeContentRouteCounts.mockReset();
  mockReadPublishedArticleBuckets.mockReset();
  mockReadPublishedArticleBuckets.mockReturnValue(
    Effect.succeed({ articleCount: 0, buckets: [], managed: false })
  );
  mockGetRuntimeContentRouteCounts.mockReturnValue(
    Effect.succeed([
      { count: 250, locale: "en", section: "articles", syncedAt: 1 },
      { count: 100, locale: "en", section: "material", syncedAt: 1 },
    ])
  );
});

describe("llms section indexes", () => {
  it("selects published partitions only after ownership activates", async () => {
    await expect(
      Effect.runPromise(
        getLlmsSectionPages({ locale: "en", section: "articles" })
      )
    ).resolves.toEqual({
      owner: "source",
      pageCount: 3,
      routeCount: 250,
    });

    mockReadPublishedArticleBuckets.mockReturnValueOnce(
      Effect.succeed({
        articleCount: 42,
        buckets: ["000", "abc"],
        managed: true,
      })
    );
    await expect(
      Effect.runPromise(
        getLlmsSectionPages({ locale: "en", section: "articles" })
      )
    ).resolves.toEqual({
      owner: "published",
      pageCount: 2,
      routeCount: 42,
    });
  });

  it("reads non-article counts without article discovery", async () => {
    await expect(
      Effect.runPromise(
        getLlmsSectionPages({ locale: "en", section: "material" })
      )
    ).resolves.toEqual({
      owner: "source",
      pageCount: 1,
      routeCount: 100,
    });
    expect(mockReadPublishedArticleBuckets).not.toHaveBeenCalled();
  });

  it("renders empty, single, and multi-page navigation", () => {
    const empty = buildLlmsSectionPageMapText({
      locale: "en",
      owner: "published",
      pageCount: 0,
      routeCount: 0,
      section: "articles",
    });
    const single = buildLlmsSectionPageMapText({
      locale: "en",
      owner: "published",
      pageCount: 1,
      routeCount: 4,
      section: "articles",
    });
    const multiple = buildLlmsSectionPageMapText({
      locale: "en",
      owner: "source",
      pageCount: 3,
      routeCount: 250,
      section: "articles",
    });

    expect(empty).toContain("0 bounded published partitions");
    expect(empty).not.toContain("/page/0/llms.txt");
    expect(single).toContain(`${BASE_URL}/llms/en/articles/page/0/llms.txt`);
    expect(single).not.toContain("last bounded content page");
    expect(multiple).toContain(`${BASE_URL}/llms/en/articles/page/2/llms.txt`);
    expect(multiple).toContain("at most 100 routes");
  });

  it("renders verified listing and page entries including empty states", () => {
    const listing = buildLlmsListingIndexText({
      entries: [articleEntry],
      locale: "en",
      route: "/articles/politics",
      section: "articles",
    });
    const emptyListing = buildLlmsListingIndexText({
      entries: [],
      locale: "en",
      route: "/articles/politics",
      section: "articles",
    });
    const page = buildLlmsPageIndexText({
      entries: [articleEntry],
      locale: "en",
      page: 0,
      section: "articles",
    });
    const emptyPage = buildLlmsPageIndexText({
      entries: [],
      locale: "en",
      page: 1,
      section: "articles",
    });

    expect(listing).toContain("verified English articles links");
    expect(listing).toContain(articleEntry.href);
    expect(emptyListing).toContain("currently has no markdown entries");
    expect(page).toContain("bounded verified links");
    expect(page).toContain(articleEntry.href);
    expect(emptyPage).toContain("content page is currently empty");
  });
});
