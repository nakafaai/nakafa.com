// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmsEntry } from "@/lib/llms/entries";
import {
  buildRootLlmsIndexText,
  getCachedLlmsSectionIndexText,
  getLlmsSectionIndexText,
} from "@/lib/llms/indexes";

const mockCacheLife = vi.hoisted(() => vi.fn());
const mockCacheTag = vi.hoisted(() => vi.fn());
const mockGetContentListingLlmsEntries = vi.hoisted(() => vi.fn());
const mockGetContentPageLlmsEntries = vi.hoisted(() => vi.fn());
const mockGetSiteLlmsEntries = vi.hoisted(() => vi.fn());

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

vi.mock("@/lib/sitemap/routes", () => ({
  readSitemapPageDescriptors: () =>
    Effect.succeed([
      { id: "base" },
      {
        id: "content_en_articles_0",
        locale: "en",
        page: 0,
        section: "articles",
      },
      {
        id: "content_en_articles_1",
        locale: "en",
        page: 1,
        section: "articles",
      },
      {
        id: "content_id_articles_0",
        locale: "id",
        page: 0,
        section: "articles",
      },
    ]),
}));

beforeEach(() => {
  mockCacheLife.mockClear();
  mockCacheTag.mockClear();
  mockGetContentListingLlmsEntries.mockReset();
  mockGetContentPageLlmsEntries.mockReset();
  mockGetSiteLlmsEntries.mockReset();
  mockGetContentListingLlmsEntries.mockReturnValue(Effect.succeed(null));
  mockGetContentPageLlmsEntries.mockReturnValue(
    Effect.succeed([
      createFixtureEntry({
        route: "/articles/politics/dynastic-politics",
        title: "Dynastic Politics",
      }),
    ])
  );
  mockGetSiteLlmsEntries.mockReturnValue(
    Effect.succeed([
      createFixtureEntry({
        route: "/search",
        title: "Search",
      }),
    ])
  );
});

describe("llms indexes", () => {
  it("builds a small root index with locale links and references", () => {
    const text = buildRootLlmsIndexText();

    expect(text.startsWith("# Nakafa\n\n> ")).toBe(true);
    expect(text).toContain("https://nakafa.com/llms/en/llms.txt");
    expect(text).toContain("https://nakafa.com/llms/id/llms.txt");
    expect(text).toContain("https://nakafa.com/mcp");
    expect(text).toContain("https://nakafa.com/llms-full.txt");
    expect(text).toContain("https://nakafa.com/llms-full/index.json");
  });

  it("builds locale and section page-map indexes without reading content pages", async () => {
    await expect(
      Effect.runPromise(getLlmsSectionIndexText("llms/en"))
    ).resolves.toContain("# Nakafa English Content");

    const sectionIndex = await Effect.runPromise(
      getLlmsSectionIndexText("llms/en/articles")
    );

    expect(sectionIndex).toContain("# Nakafa English Articles Pages");
    expect(sectionIndex).toContain(
      "https://nakafa.com/llms/en/articles/page/0/llms.txt"
    );
    expect(sectionIndex).toContain(
      "https://nakafa.com/llms/en/articles/page/1/llms.txt"
    );
    expect(mockGetContentPageLlmsEntries).not.toHaveBeenCalled();
  });

  it("builds one bounded content page index from the page reader", async () => {
    mockGetContentPageLlmsEntries.mockReturnValueOnce(
      Effect.succeed([
        createFixtureEntry({
          description: "",
          route: "/articles/politics/dynastic-politics",
          title: "Dynastic Politics",
        }),
      ])
    );

    const text = await Effect.runPromise(
      getLlmsSectionIndexText("llms/en/articles/page/7/llms.txt")
    );

    expect(text).toContain("# Nakafa English Articles Page 7");
    expect(text).toContain(
      "- [Dynastic Politics](https://nakafa.com/en/articles/politics/dynastic-politics.md)"
    );
    expect(mockGetContentPageLlmsEntries).toHaveBeenCalledWith({
      locale: "en",
      page: 7,
      section: "articles",
    });
  });

  it("builds one content listing index from route-catalog entries", async () => {
    mockGetContentListingLlmsEntries.mockReturnValueOnce(
      Effect.succeed([
        createFixtureEntry({
          route: "/articles/politics/dynastic-politics",
          title: "Dynastic Politics",
        }),
      ])
    );

    const text = await Effect.runPromise(
      getLlmsSectionIndexText("llms/en/articles/politics")
    );

    expect(text).toContain("# Politics Articles");
    expect(text).toContain(
      "- [Dynastic Politics](https://nakafa.com/en/articles/politics/dynastic-politics.md)"
    );
    expect(mockGetContentListingLlmsEntries).toHaveBeenCalledWith({
      locale: "en",
      route: "articles/politics",
    });
  });

  it("renders an explicit empty content listing index", async () => {
    mockGetContentListingLlmsEntries.mockReturnValueOnce(Effect.succeed([]));

    const text = await Effect.runPromise(
      getLlmsSectionIndexText("llms/en/articles/politics")
    );

    expect(text).toContain("# Politics Articles");
    expect(text).toContain(
      "This English articles listing currently has no markdown entries."
    );
  });

  it("renders an explicit empty bounded content page index", async () => {
    mockGetContentPageLlmsEntries.mockReturnValueOnce(Effect.succeed([]));

    const text = await Effect.runPromise(
      getLlmsSectionIndexText("llms/en/articles/page/99/llms.txt")
    );

    expect(text).toContain("# Nakafa English Articles Page 99");
    expect(text).toContain(
      "This bounded articles route-catalog page is currently empty."
    );
  });

  it("builds the site index from static site entries only", async () => {
    const text = await Effect.runPromise(
      getLlmsSectionIndexText("llms/en/site")
    );

    expect(text).toContain("# Nakafa English Site Pages");
    expect(text).toContain("https://nakafa.com/en/search");
    expect(mockGetSiteLlmsEntries).toHaveBeenCalledWith("en");
    expect(mockGetContentPageLlmsEntries).not.toHaveBeenCalled();
  });

  it("does not generate indexes for unknown or malformed llms paths", async () => {
    await expect(
      Effect.runPromise(getLlmsSectionIndexText("docs"))
    ).resolves.toBeNull();
    await expect(
      Effect.runPromise(getLlmsSectionIndexText("llms/fr"))
    ).resolves.toBeNull();
    await expect(
      Effect.runPromise(getLlmsSectionIndexText("llms/en/unknown"))
    ).resolves.toBeNull();
    await expect(
      Effect.runPromise(getLlmsSectionIndexText("llms/en/articles/shard/999"))
    ).resolves.toBeNull();
    await expect(
      Effect.runPromise(
        getLlmsSectionIndexText("llms/en/articles/page/not-a-number/llms.txt")
      )
    ).resolves.toBeNull();
  });

  it("uses the Next cache boundary without changing section output", async () => {
    await expect(
      getCachedLlmsSectionIndexText({ cleanSlug: "llms/en" })
    ).resolves.toContain("# Nakafa English Content");

    expect(mockCacheTag).toHaveBeenCalledWith("content-runtime");
    expect(mockCacheLife).toHaveBeenCalledWith("contentRuntime");
  });
});

/** Creates one sitemap-shaped llms entry without reading the content corpus. */
function createFixtureEntry({
  description = "Fixture description",
  route,
  title,
}: {
  description?: string;
  route: string;
  title: string;
}): LlmsEntry {
  const routeSegments = route.split("/").filter(Boolean);
  const section = routeSegments[0] ?? "site";
  const entrySection = section === "articles" ? "articles" : "site";
  const segments =
    entrySection === "site" ? ["site", ...routeSegments] : routeSegments;
  const href =
    entrySection === "site"
      ? `https://nakafa.com/en${route === "/" ? "" : route}`
      : `https://nakafa.com/en${route}.md`;

  return {
    description,
    href,
    route,
    section: entrySection,
    segments,
    title,
  };
}
