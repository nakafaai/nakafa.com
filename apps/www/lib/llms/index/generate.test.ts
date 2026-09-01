// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { BASE_URL } from "@/lib/llms/constants";
import type { LlmsEntry } from "@/lib/llms/entries";
import { getLlmsSectionIndexText } from "@/lib/llms/index/generate";

const mockGetContentListingLlmsEntries = vi.hoisted(() => vi.fn());
const mockGetContentPageLlmsEntries = vi.hoisted(() => vi.fn());
const mockReadPublishedArticleBuckets = vi.hoisted(() => vi.fn());
const mockReadPublishedMaterialBuckets = vi.hoisted(() => vi.fn());
const mockReadQuranInventory = vi.hoisted(() => vi.fn());
const mockReadSiteLlmsEntries = vi.hoisted(() => vi.fn());

const articleEntry: LlmsEntry = {
  description:
    "How Asian values are used to justify dynastic politics in Indonesian local elections, and why that argument matters for democracy.",
  href: `${BASE_URL}/en/articles/politics/dynastic-politics-asian-values.md`,
  route: "/articles/politics/dynastic-politics-asian-values",
  section: "articles",
  segments: ["articles", "politics", "dynastic-politics-asian-values"],
  title: "Framing Dynastic Politics in Local Elections within Asian Values",
};
const siteEntry: LlmsEntry = {
  href: `${BASE_URL}/en/search`,
  route: "/search",
  section: "site",
  segments: ["site", "search"],
  title: "Search",
};

vi.mock("@/lib/llms/entries", async () => {
  const constants = await import("@/lib/llms/constants");

  const isLlmsSection = (section: unknown) =>
    typeof section === "string" &&
    Object.hasOwn(constants.SECTION_LABELS, section);

  return {
    getLlmsSections: () => Object.keys(constants.SECTION_LABELS),
    isLlmsSection,
  };
});

vi.mock("@/lib/llms/site", () => ({
  readSiteLlmsEntries: mockReadSiteLlmsEntries,
}));

vi.mock("@/lib/llms/content/entries", () => ({
  getContentPageLlmsEntries: mockGetContentPageLlmsEntries,
}));

vi.mock("@/lib/llms/content/listing", () => ({
  getContentListingLlmsEntries: mockGetContentListingLlmsEntries,
}));

vi.mock("@/lib/content/article/sitemap", () => ({
  readPublishedArticleBuckets: mockReadPublishedArticleBuckets,
}));
vi.mock("@/lib/content/material/sitemap", () => ({
  readPublishedMaterialBuckets: mockReadPublishedMaterialBuckets,
}));
vi.mock("@/lib/llms/quran", () => ({
  readQuranLlmsInventory: mockReadQuranInventory,
}));

beforeEach(() => {
  mockGetContentListingLlmsEntries.mockReset();
  mockGetContentPageLlmsEntries.mockReset();
  mockReadPublishedArticleBuckets.mockReset();
  mockReadPublishedMaterialBuckets.mockReset();
  mockReadQuranInventory.mockReset();
  mockReadSiteLlmsEntries.mockReset();
  mockGetContentListingLlmsEntries.mockReturnValue(Effect.succeed(null));
  mockGetContentPageLlmsEntries.mockReturnValue(Effect.succeed([articleEntry]));
  mockReadSiteLlmsEntries.mockReturnValue(Effect.succeed([siteEntry]));
  mockReadPublishedArticleBuckets.mockReturnValue(
    Effect.succeed({
      activeReleaseId: "release-article",
      articleCount: 250,
      buckets: ["000", "abc", "fff"],
    })
  );
  mockReadPublishedMaterialBuckets.mockReturnValue(
    Effect.succeed({
      activeReleaseId: "release-material",
      buckets: ["abc"],
      materialCount: 100,
    })
  );
  mockReadQuranInventory.mockReturnValue(
    Effect.succeed({ pageCount: 1, routeCount: 114 })
  );
});

describe("llms indexes", () => {
  it.effect("builds locale indexes with direct starter pages", () =>
    Effect.gen(function* () {
      const text = yield* getLlmsSectionIndexText("llms/en");

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
      expect(text).toContain(`- [${articleEntry.title}](${articleEntry.href})`);
      expect(mockGetContentPageLlmsEntries).toHaveBeenCalled();
    })
  );

  it.effect("omits missing locale page artifacts from starter pages", () =>
    Effect.gen(function* () {
      mockGetContentPageLlmsEntries.mockReturnValue(Effect.succeed(null));
      mockReadSiteLlmsEntries.mockReturnValue(Effect.succeed([]));

      const text = yield* getLlmsSectionIndexText("llms/en");

      expect(text).toContain("# Nakafa English Content");
      expect(text).not.toContain("## Starter Pages");
    })
  );

  it.effect(
    "builds section page-map indexes without reading content pages",
    () =>
      Effect.gen(function* () {
        mockGetContentPageLlmsEntries.mockClear();

        const sectionIndex = yield* getLlmsSectionIndexText("llms/en/articles");

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
      })
  );

  it.effect("builds article page maps from the signed catalog", () =>
    Effect.gen(function* () {
      mockReadPublishedArticleBuckets.mockReturnValue(
        Effect.succeed({
          activeReleaseId: "release-article",
          articleCount: 42,
          buckets: ["000", "abc"],
        })
      );

      const text = yield* getLlmsSectionIndexText("llms/en/articles");

      expect(text).toContain("42 English articles routes");
      expect(text).toContain("2 bounded published partitions");
      expect(text).toContain(`${BASE_URL}/llms/en/articles/page/1/llms.txt`);
    })
  );

  it.effect("keeps empty and single-page section maps constant", () =>
    Effect.gen(function* () {
      const singlePageIndex =
        yield* getLlmsSectionIndexText("llms/en/material");

      expect(singlePageIndex).toContain(
        `${BASE_URL}/llms/en/material/page/0/llms.txt`
      );
      expect(singlePageIndex).not.toContain("last bounded route-catalog page");

      mockReadPublishedArticleBuckets.mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId: "release-article",
          articleCount: 0,
          buckets: [],
        })
      );

      const emptyIndex = yield* getLlmsSectionIndexText("llms/en/articles");

      expect(emptyIndex).toContain("0 English articles routes");
      expect(emptyIndex).not.toContain("/page/0/llms.txt");
    })
  );

  it.effect("builds one bounded content page index from the page reader", () =>
    Effect.gen(function* () {
      mockGetContentPageLlmsEntries.mockReturnValueOnce(
        Effect.succeed([{ ...articleEntry, description: "" }])
      );

      const text = yield* getLlmsSectionIndexText(
        "llms/en/articles/page/7/llms.txt"
      );

      expect(text).toContain("# Nakafa English Articles Page 7");
      expect(text).toContain(`- [${articleEntry.title}](${articleEntry.href})`);
      expect(mockGetContentPageLlmsEntries).toHaveBeenCalledWith({
        locale: "en",
        page: 7,
        section: "articles",
      });
    })
  );

  it.effect("builds one content listing index from route-catalog entries", () =>
    Effect.gen(function* () {
      mockGetContentListingLlmsEntries.mockReturnValueOnce(
        Effect.succeed([articleEntry])
      );

      const text = yield* getLlmsSectionIndexText("llms/en/articles/politics");

      expect(text).toContain("# Politics Articles");
      expect(text).toContain(`- [${articleEntry.title}](${articleEntry.href})`);
      expect(mockGetContentListingLlmsEntries).toHaveBeenCalledWith({
        locale: "en",
        route: "articles/politics",
      });
    })
  );

  it.effect("renders explicit empty listing and page indexes", () =>
    Effect.gen(function* () {
      mockGetContentListingLlmsEntries.mockReturnValueOnce(Effect.succeed([]));

      const text = yield* getLlmsSectionIndexText("llms/en/articles/politics");

      expect(text).toContain("# Politics Articles");
      expect(text).toContain(
        "This English articles listing currently has no markdown entries."
      );
      mockGetContentPageLlmsEntries.mockReturnValueOnce(Effect.succeed([]));

      const pageText = yield* getLlmsSectionIndexText(
        "llms/en/articles/page/99/llms.txt"
      );

      expect(pageText).toContain("# Nakafa English Articles Page 99");
      expect(pageText).toContain(
        "This bounded articles content page is currently empty."
      );
    })
  );

  it.effect("returns null when a bounded page artifact is missing", () =>
    Effect.gen(function* () {
      mockGetContentPageLlmsEntries.mockReturnValueOnce(Effect.succeed(null));

      const text = yield* getLlmsSectionIndexText(
        "llms/en/articles/page/999/llms.txt"
      );

      expect(text).toBeNull();
    })
  );

  it.effect("builds the site index from static site entries only", () =>
    Effect.gen(function* () {
      const text = yield* getLlmsSectionIndexText("llms/en/site");

      expect(text).toContain("# Nakafa English Site Pages");
      expect(text).toContain(`${BASE_URL}/en/search`);
      expect(mockReadSiteLlmsEntries).toHaveBeenCalledWith("en");
      expect(mockGetContentPageLlmsEntries).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "does not generate indexes for unknown or malformed llms paths",
    () =>
      Effect.gen(function* () {
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
          expect(yield* getLlmsSectionIndexText(path)).toBeNull();
        }
      })
  );
});
