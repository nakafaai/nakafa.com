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

const mockReadPublishedArticleBuckets = vi.hoisted(() => vi.fn());
const mockReadMaterialInventory = vi.hoisted(() => vi.fn());
const mockReadQuranInventory = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/article/sitemap", () => ({
  readPublishedArticleBuckets: mockReadPublishedArticleBuckets,
}));
vi.mock("@/lib/llms/material-pages", () => ({
  readMaterialLlmsInventory: mockReadMaterialInventory,
}));
vi.mock("@/lib/llms/quran", () => ({
  readQuranLlmsInventory: mockReadQuranInventory,
}));

const articleEntry: LlmsEntry = {
  description:
    "How Asian values are used to justify dynastic politics in Indonesian local elections, and why that argument matters for democracy.",
  href: `${BASE_URL}/en/articles/politics/dynastic-politics-asian-values.md`,
  route: "/articles/politics/dynastic-politics-asian-values",
  section: "articles",
  segments: ["articles", "politics", "dynastic-politics-asian-values"],
  title: "Framing Dynastic Politics in Local Elections within Asian Values",
};

beforeEach(() => {
  mockReadPublishedArticleBuckets.mockReset();
  mockReadMaterialInventory.mockReset();
  mockReadQuranInventory.mockReset();
  mockReadPublishedArticleBuckets.mockReturnValue(
    Effect.succeed({
      articleCount: 250,
      buckets: ["000", "abc", "fff"],
    })
  );
  mockReadMaterialInventory.mockReturnValue(
    Effect.succeed({
      activeReleaseId: "release-material",
      buckets: ["abc"],
      pageCount: 1,
      routeCount: 100,
    })
  );
  mockReadQuranInventory.mockReturnValue(
    Effect.succeed({ pageCount: 1, routeCount: 114 })
  );
});

describe("llms section indexes", () => {
  it("reads signed article partitions without source discovery", async () => {
    await expect(
      Effect.runPromise(
        getLlmsSectionPages({ locale: "en", section: "articles" })
      )
    ).resolves.toEqual({
      pageCount: 3,
      routeCount: 250,
    });
    expect(mockReadQuranInventory).not.toHaveBeenCalled();
  });

  it("reads signed material counts without source discovery", async () => {
    await expect(
      Effect.runPromise(
        getLlmsSectionPages({ locale: "en", section: "material" })
      )
    ).resolves.toEqual({
      pageCount: 1,
      routeCount: 100,
    });
    expect(mockReadPublishedArticleBuckets).not.toHaveBeenCalled();
  });

  it("uses signed material partitions", async () => {
    mockReadMaterialInventory.mockReturnValue(
      Effect.succeed({
        activeReleaseId: "release-material",
        buckets: ["000", "abc"],
        pageCount: 2,
        routeCount: 42,
      })
    );

    await expect(
      Effect.runPromise(
        getLlmsSectionPages({ locale: "en", section: "material" })
      )
    ).resolves.toEqual({
      pageCount: 2,
      routeCount: 42,
    });
    expect(mockReadQuranInventory).not.toHaveBeenCalled();
  });

  it("reads the signed Quran inventory and handles an empty release", async () => {
    await expect(
      Effect.runPromise(getLlmsSectionPages({ locale: "en", section: "quran" }))
    ).resolves.toEqual({
      pageCount: 1,
      routeCount: 114,
    });

    mockReadQuranInventory.mockReturnValueOnce(
      Effect.succeed({ pageCount: 0, routeCount: 0 })
    );
    await expect(
      Effect.runPromise(getLlmsSectionPages({ locale: "id", section: "quran" }))
    ).resolves.toEqual({
      pageCount: 0,
      routeCount: 0,
    });
  });

  it("renders empty, single, and multi-page navigation", () => {
    const empty = buildLlmsSectionPageMapText({
      locale: "en",
      pageCount: 0,
      routeCount: 0,
      section: "articles",
    });
    const single = buildLlmsSectionPageMapText({
      locale: "en",
      pageCount: 1,
      routeCount: 4,
      section: "articles",
    });
    const multiple = buildLlmsSectionPageMapText({
      locale: "en",
      pageCount: 3,
      routeCount: 250,
      section: "articles",
    });

    expect(empty).toContain("0 bounded published partitions");
    expect(empty).not.toContain("/page/0/llms.txt");
    expect(single).toContain(`${BASE_URL}/llms/en/articles/page/0/llms.txt`);
    expect(single).not.toContain("last bounded content page");
    expect(multiple).toContain(`${BASE_URL}/llms/en/articles/page/2/llms.txt`);
    expect(multiple).toContain("3 bounded published partitions");
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
