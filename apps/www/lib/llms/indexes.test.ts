// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BASE_URL } from "@/lib/llms/constants";
import type { LlmsEntry } from "@/lib/llms/entries";
import {
  getCachedLlmsSectionIndexText,
  getLlmsSectionIndexText,
} from "@/lib/llms/indexes";

const mockCacheLife = vi.hoisted(() => vi.fn());
const mockCacheTag = vi.hoisted(() => vi.fn());
const mockGetContentListingLlmsEntries = vi.hoisted(() => vi.fn());
const mockGetContentPageLlmsEntries = vi.hoisted(() => vi.fn());
const mockGetRuntimeContentRouteCounts = vi.hoisted(() => vi.fn());
const mockGetSiteLlmsEntries = vi.hoisted(() => vi.fn());

const articleEntry: LlmsEntry = {
  description: "Fixture description",
  href: `${BASE_URL}/en/articles/politics/dynastic-politics.md`,
  route: "/articles/politics/dynastic-politics",
  section: "articles",
  segments: ["articles", "politics", "dynastic-politics"],
  title: "Dynastic Politics",
};
const siteEntry: LlmsEntry = {
  description: "Fixture description",
  href: `${BASE_URL}/en/search`,
  route: "/search",
  section: "site",
  segments: ["site", "search"],
  title: "Search",
};

vi.mock("next/cache", () => ({
  cacheLife: mockCacheLife,
  cacheTag: mockCacheTag,
}));

vi.mock("@/lib/llms/entries", async () => {
  const constants = await import("@/lib/llms/constants");

  const isLlmsSection = (section: unknown) =>
    typeof section === "string" &&
    Object.hasOwn(constants.SECTION_LABELS, section);

  return {
    getContentListingLlmsEntries: mockGetContentListingLlmsEntries,
    getContentPageLlmsEntries: mockGetContentPageLlmsEntries,
    getLlmsSections: () => Object.keys(constants.SECTION_LABELS),
    getSiteLlmsEntries: mockGetSiteLlmsEntries,
    isLlmsSection,
  };
});

vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimeContentRouteCounts: mockGetRuntimeContentRouteCounts,
}));

beforeEach(() => {
  mockCacheLife.mockClear();
  mockCacheTag.mockClear();
  mockGetContentListingLlmsEntries.mockReset();
  mockGetContentPageLlmsEntries.mockReset();
  mockGetRuntimeContentRouteCounts.mockReset();
  mockGetSiteLlmsEntries.mockReset();
  mockGetContentListingLlmsEntries.mockReturnValue(Effect.succeed(null));
  mockGetContentPageLlmsEntries.mockReturnValue(Effect.succeed([articleEntry]));
  mockGetSiteLlmsEntries.mockReturnValue([siteEntry]);
  mockGetRuntimeContentRouteCounts.mockReturnValue(
    Effect.succeed([
      { count: 250, locale: "en", section: "articles", syncedAt: 1 },
      { count: 100, locale: "en", section: "material", syncedAt: 1 },
      { count: 114, locale: "en", section: "quran", syncedAt: 1 },
    ])
  );
});

describe("llms indexes", () => {
  it("builds locale indexes with direct starter pages", async () => {
    const text = await Effect.runPromise(getLlmsSectionIndexText("llms/en"));

    expect(text).toContain("# Nakafa English Content");
    expect(text).toContain("## Sections");
    expect(text).toContain("## Starter Pages");
    for (const prefix of [
      "articles",
      "subjects",
      "curriculum",
      "try-out",
      "quran",
    ]) {
      expect(text).toContain(`${BASE_URL}/en/${prefix}/llms.txt`);
    }
    expect(text).toContain(`${BASE_URL}/en/search`);
    expect(text).toContain(
      `- [Dynastic Politics](${BASE_URL}/en/articles/politics/dynastic-politics.md)`
    );
    expect(mockGetContentPageLlmsEntries).toHaveBeenCalled();
  });

  it("omits the starter page section when locale page entries are empty", async () => {
    mockGetContentPageLlmsEntries.mockReturnValue(Effect.succeed([]));
    mockGetSiteLlmsEntries.mockReturnValue([]);

    const text = await Effect.runPromise(getLlmsSectionIndexText("llms/en"));

    expect(text).toContain("# Nakafa English Content");
    expect(text).not.toContain("## Starter Pages");
  });

  it("builds section page-map indexes without reading content pages", async () => {
    mockGetContentPageLlmsEntries.mockClear();

    const sectionIndex = await Effect.runPromise(
      getLlmsSectionIndexText("llms/en/articles")
    );

    expect(sectionIndex).toContain("# Nakafa English Articles Pages");
    expect(sectionIndex).toContain(
      `${BASE_URL}/llms/en/articles/page/0/llms.txt`
    );
    expect(sectionIndex).toContain(
      `${BASE_URL}/llms/en/articles/page/2/llms.txt`
    );
    expect(sectionIndex).toContain(
      `${BASE_URL}/llms/en/articles/page/{page}/llms.txt`
    );
    expect(sectionIndex).not.toContain(
      `${BASE_URL}/llms/en/articles/page/1/llms.txt`
    );
    expect(sectionIndex).toContain("250 English articles routes");
    expect(mockGetContentPageLlmsEntries).not.toHaveBeenCalled();
  });

  it("keeps empty and single-page section maps constant", async () => {
    const singlePageIndex = await Effect.runPromise(
      getLlmsSectionIndexText("llms/en/material")
    );

    expect(singlePageIndex).toContain(
      `${BASE_URL}/llms/en/material/page/0/llms.txt`
    );
    expect(singlePageIndex).not.toContain("last bounded route-catalog page");

    mockGetRuntimeContentRouteCounts.mockReturnValueOnce(Effect.succeed([]));

    const emptyIndex = await Effect.runPromise(
      getLlmsSectionIndexText("llms/en/articles")
    );

    expect(emptyIndex).toContain("0 English articles routes");
    expect(emptyIndex).not.toContain("/page/0/llms.txt");
  });

  it("builds one bounded content page index from the page reader", async () => {
    mockGetContentPageLlmsEntries.mockReturnValueOnce(
      Effect.succeed([{ ...articleEntry, description: "" }])
    );

    const text = await Effect.runPromise(
      getLlmsSectionIndexText("llms/en/articles/page/7/llms.txt")
    );

    expect(text).toContain("# Nakafa English Articles Page 7");
    expect(text).toContain(
      `- [Dynastic Politics](${BASE_URL}/en/articles/politics/dynastic-politics.md)`
    );
    expect(mockGetContentPageLlmsEntries).toHaveBeenCalledWith({
      locale: "en",
      page: 7,
      section: "articles",
    });
  });

  it("builds one content listing index from route-catalog entries", async () => {
    mockGetContentListingLlmsEntries.mockReturnValueOnce(
      Effect.succeed([articleEntry])
    );

    const text = await Effect.runPromise(
      getLlmsSectionIndexText("llms/en/articles/politics")
    );

    expect(text).toContain("# Politics Articles");
    expect(text).toContain(
      `- [Dynastic Politics](${BASE_URL}/en/articles/politics/dynastic-politics.md)`
    );
    expect(mockGetContentListingLlmsEntries).toHaveBeenCalledWith({
      locale: "en",
      route: "articles/politics",
    });
  });

  it("renders explicit empty listing and page indexes", async () => {
    mockGetContentListingLlmsEntries.mockReturnValueOnce(Effect.succeed([]));

    const text = await Effect.runPromise(
      getLlmsSectionIndexText("llms/en/articles/politics")
    );

    expect(text).toContain("# Politics Articles");
    expect(text).toContain(
      "This English articles listing currently has no markdown entries."
    );
    mockGetContentPageLlmsEntries.mockReturnValueOnce(Effect.succeed([]));

    const pageText = await Effect.runPromise(
      getLlmsSectionIndexText("llms/en/articles/page/99/llms.txt")
    );

    expect(pageText).toContain("# Nakafa English Articles Page 99");
    expect(pageText).toContain(
      "This bounded articles route-catalog page is currently empty."
    );
  });

  it("builds the site index from static site entries only", async () => {
    const text = await Effect.runPromise(
      getLlmsSectionIndexText("llms/en/site")
    );

    expect(text).toContain("# Nakafa English Site Pages");
    expect(text).toContain(`${BASE_URL}/en/search`);
    expect(mockGetSiteLlmsEntries).toHaveBeenCalledWith("en");
    expect(mockGetContentPageLlmsEntries).not.toHaveBeenCalled();
  });

  it("does not generate indexes for unknown or malformed llms paths", async () => {
    const paths = [
      "docs",
      "llms/fr",
      "llms/en/unknown",
      "llms/en/articles/shard/999",
      "llms/en/articles/page/not-a-number/llms.txt",
      "llms/en/articles/page/7junk/llms.txt",
      "llms/en/articles/page/07/llms.txt",
    ];

    for (const path of paths) {
      await expect(
        Effect.runPromise(getLlmsSectionIndexText(path))
      ).resolves.toBeNull();
    }
  });

  it("uses the Next cache boundary without changing section output", async () => {
    await expect(
      getCachedLlmsSectionIndexText({ cleanSlug: "llms/en" })
    ).resolves.toContain("# Nakafa English Content");

    expect(mockCacheTag).toHaveBeenCalledWith("content-runtime");
    expect(mockCacheLife).toHaveBeenCalledWith("contentRuntime");
  });
});
