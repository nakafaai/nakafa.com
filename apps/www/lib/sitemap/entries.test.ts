// @vitest-environment node
import { assert, beforeEach, describe, expect, it } from "@effect/vitest";
import type { getPathname } from "@repo/internationalization/src/navigation";
import { Array as Arr, DateTime, Effect, HashSet } from "effect";
import {
  getCachedSitemapEntries,
  getSitemapEntries,
} from "@/lib/sitemap/entries";
import { SitemapPageNotFoundError } from "@/lib/sitemap/identity";
import { resetTestRuntimeCache } from "@/test/store";

const mockReadSitemapRoutePage = vi.hoisted(() => vi.fn());
const mockGetSitemapPageDescriptor = vi.hoisted(() => vi.fn());
const mockGetPathname = vi.hoisted(() =>
  vi.fn<typeof getPathname>(({ href, locale }) => {
    const pathname = typeof href === "string" ? href : href.pathname;
    const route = pathname.startsWith("/") ? pathname : `/${pathname}`;

    return `/${locale}${route === "/" ? "" : route}`;
  })
);

vi.mock("@repo/internationalization/src/navigation", () => ({
  getPathname: mockGetPathname,
}));

vi.mock("@repo/internationalization/src/routing", () => ({
  routing: {
    defaultLocale: "en",
    locales: ["en", "id", "de"],
    pathnames: {
      "/curricula": {
        de: "/lehrplaene",
        en: "/curriculum",
        id: "/kurikulum",
      },
    },
  },
}));

vi.mock("@/lib/sitemap/routes", () => ({
  baseRoutes: [
    "/",
    "/contributor",
    "/curricula",
    "/pricing",
    "/quran",
    "/search",
  ],
  readSitemapRoutePage: mockReadSitemapRoutePage,
}));

vi.mock(import("@/lib/sitemap/identity"), async (importOriginal) => ({
  ...(await importOriginal()),
  getSitemapPageDescriptor: mockGetSitemapPageDescriptor,
}));

const activeIdentity = {
  manifestHash: `sha256:${"a".repeat(64)}`,
  releaseId: "release-sitemap",
  sequence: 1,
};

const mockCacheLife = vi.hoisted(() => vi.fn());
const mockCacheTag = vi.hoisted(() => vi.fn());
const activeMocks = vi.hoisted(() => ({
  load: vi.fn(),
  read: vi.fn(),
}));

vi.mock("@/lib/content/published/active", () => ({
  expireActiveContentIdentity: vi.fn(),
  loadActiveContentIdentity: activeMocks.load,
  readActiveContentIdentity: activeMocks.read,
}));

vi.mock("@vercel/functions", async () => {
  const { testRuntimeCache: cache } = await import("@/test/store");
  return { getCache: () => cache };
});

vi.mock("next/cache", () => ({
  /** Records sitemap origin-cache usage without touching Next internals. */
  cacheLife: mockCacheLife,
  /** Records sitemap origin-cache usage without touching Next internals. */
  cacheTag: mockCacheTag,
  /** Unused in these tests; present for module completeness. */
  revalidateTag: vi.fn(),
}));

beforeEach(() => {
  resetTestRuntimeCache();
  activeMocks.read.mockReset().mockReturnValue(Effect.succeed(activeIdentity));
  activeMocks.load.mockReset().mockReturnValue(Effect.succeed(activeIdentity));
  mockReadSitemapRoutePage.mockReset();
  mockGetSitemapPageDescriptor.mockReset();
  mockGetPathname.mockClear();
  mockCacheLife.mockClear();
  mockCacheTag.mockClear();

  mockGetSitemapPageDescriptor.mockReturnValue({ id: "base" });
  mockReadSitemapRoutePage.mockReturnValue(
    Effect.succeed({
      routes: [
        { path: "/" },
        { path: "/search" },
        {
          lastModified: "2024-01-02",
          path: "/articles/politics/dynastic-politics-asian-values",
        },
        { path: "/quran/1" },
        {
          path: "/subjects/chemistry/green-chemistry/definition",
        },
        { path: "/curriculum/merdeka/class-10/mathematics/integral" },
        {
          path: "/try-out/indonesia/snbt/2027/set-1/quantitative-knowledge",
        },
      ],
    })
  );
});

describe("sitemap entries", () => {
  it.effect("generates sitemap entries from route and locale inputs", () =>
    Effect.gen(function* () {
      const entries = yield* getSitemapEntries({ pageId: "base" });
      const urls = Arr.map(entries, (entry) => entry.url);

      expect(HashSet.size(HashSet.fromIterable(urls))).toBe(urls.length);
      expect(urls).toContain("https://nakafa.com/en");
      expect(urls).toContain("https://nakafa.com/id");
      expect(urls).toContain("https://nakafa.com/de");
      expect(urls).not.toContain("https://nakafa.com/en/about");
      expect(urls).not.toContain("https://nakafa.com/id/about");
      expect(urls).toContain(
        "https://nakafa.com/en/subjects/chemistry/green-chemistry/definition"
      );
      expect(entries).toContainEqual({
        lastModified: "2024-01-02",
        url: "https://nakafa.com/en/articles/politics/dynastic-politics-asian-values",
      });
      expect(entries).toContainEqual({
        url: "https://nakafa.com/en/subjects/chemistry/green-chemistry/definition",
      });
      expect(
        Arr.every(
          entries,
          (entry) =>
            !(
              "changeFrequency" in entry ||
              "priority" in entry ||
              "alternates" in entry
            )
        )
      ).toBe(true);
    })
  );

  it.effect("keeps English content sitemap pages scoped to English URLs", () =>
    Effect.gen(function* () {
      mockGetSitemapPageDescriptor.mockReturnValueOnce({
        id: "content_en_articles_0",
        kind: "content",
        locale: "en",
        page: 0,
        section: "articles",
      });
      mockReadSitemapRoutePage.mockReturnValueOnce(
        Effect.succeed({
          routes: [
            {
              lastModified: "2024-01-02",
              path: "/articles/politics/dynastic-politics-asian-values",
            },
          ],
        })
      );

      const entries = yield* getSitemapEntries({
        pageId: "content_en_articles_0",
      });

      expect(entries).toHaveLength(1);
      expect(entries[0]?.url).toBe(
        "https://nakafa.com/en/articles/politics/dynastic-politics-asian-values"
      );
      expect(entries[0]).toEqual({
        lastModified: "2024-01-02",
        url: "https://nakafa.com/en/articles/politics/dynastic-politics-asian-values",
      });
    })
  );

  it.effect(
    "keeps Indonesian content sitemap pages scoped to Indonesian URLs",
    () =>
      Effect.gen(function* () {
        mockGetSitemapPageDescriptor.mockReturnValueOnce({
          id: "content_id_articles_0",
          kind: "content",
          locale: "id",
          page: 0,
          section: "articles",
        });
        mockReadSitemapRoutePage.mockReturnValueOnce(
          Effect.succeed({
            routes: [
              {
                lastModified: "2024-01-02",
                path: "/articles/politics/nepotism-in-political-governance",
              },
            ],
          })
        );

        const entries = yield* getSitemapEntries({
          pageId: "content_id_articles_0",
        });

        expect(entries).toHaveLength(1);
        expect(entries[0]?.url).toBe(
          "https://nakafa.com/id/articles/politics/nepotism-in-political-governance"
        );
        expect(entries[0]).toEqual({
          lastModified: "2024-01-02",
          url: "https://nakafa.com/id/articles/politics/nepotism-in-political-governance",
        });
      })
  );

  it.effect("keeps base sitemap pages localized across supported locales", () =>
    Effect.gen(function* () {
      mockGetSitemapPageDescriptor.mockReturnValueOnce({ id: "base" });
      mockReadSitemapRoutePage.mockReturnValueOnce(
        Effect.succeed({ routes: [{ path: "/search" }] })
      );

      const entries = yield* getSitemapEntries({ pageId: "base" });

      expect(Arr.map(entries, (entry) => entry.url)).toEqual([
        "https://nakafa.com/en/search",
        "https://nakafa.com/id/search",
        "https://nakafa.com/de/search",
      ]);
      expect(Arr.every(entries, (entry) => !("alternates" in entry))).toBe(
        true
      );
    })
  );

  it.effect(
    "localizes the curriculum index route in base sitemap entries",
    () =>
      Effect.gen(function* () {
        mockGetSitemapPageDescriptor.mockReturnValueOnce({ id: "base" });
        mockReadSitemapRoutePage.mockReturnValueOnce(
          Effect.succeed({ routes: [{ path: "/curricula" }] })
        );

        const entries = yield* getSitemapEntries({ pageId: "base" });

        expect(Arr.map(entries, (entry) => entry.url)).toEqual([
          "https://nakafa.com/en/curriculum",
          "https://nakafa.com/id/kurikulum",
          "https://nakafa.com/de/lehrplaene",
        ]);
      })
  );

  it.effect(
    "publishes signed Page paths with only their source-owned date",
    () =>
      Effect.gen(function* () {
        mockGetSitemapPageDescriptor.mockReturnValueOnce({
          id: "page_de",
          kind: "page",
          locale: "de",
        });
        mockReadSitemapRoutePage.mockReturnValueOnce(
          Effect.succeed({
            routes: [
              {
                lastModified: "2026-08-21",
                path: "/impressum",
              },
            ],
          })
        );

        const entries = yield* getSitemapEntries({ pageId: "page_de" });

        expect(entries).toEqual([
          expect.objectContaining({
            lastModified: "2026-08-21",
            url: "https://nakafa.com/de/impressum",
          }),
        ]);
      })
  );

  it.effect("does not invent dates for undated routes", () =>
    Effect.gen(function* () {
      mockGetSitemapPageDescriptor.mockReturnValueOnce({
        id: "page_de",
        kind: "page",
        locale: "de",
      });
      mockReadSitemapRoutePage.mockReturnValueOnce(
        Effect.succeed({
          routes: [
            {
              path: "/impressum",
            },
          ],
        })
      );

      const entries = yield* getSitemapEntries({ pageId: "page_de" });

      expect(entries).toEqual([{ url: "https://nakafa.com/de/impressum" }]);
    })
  );

  it("shares base sitemap pages through the origin cache", async () => {
    const page = await getCachedSitemapEntries({ pageId: "base" });

    assert(page._tag === "Found");
    expect(page.entries.length).toBeGreaterThan(0);
    expect(mockCacheTag).toHaveBeenCalledWith("content-sitemap");
    expect(mockCacheLife).toHaveBeenCalledWith("max");
  });

  it("shares material partitions through the origin cache", async () => {
    mockGetSitemapPageDescriptor.mockReturnValue({
      id: "material_en_p0",
      kind: "material",
      locale: "en",
      partition: 0,
    });

    const page = await getCachedSitemapEntries({ pageId: "material_en_p0" });

    assert(page._tag === "Found");
    expect(page.entries.length).toBeGreaterThan(0);
    expect(mockCacheTag).toHaveBeenCalledWith("content-sitemap");
  });

  it("tags unknown sitemap pages with only the shared sitemap tag", async () => {
    mockGetSitemapPageDescriptor.mockReturnValue(null);

    await getCachedSitemapEntries({ pageId: "unknown" });

    expect(mockCacheTag).toHaveBeenCalledWith("content-sitemap");
  });

  it("caches a route's modification date as the text the route carries", async () => {
    mockGetSitemapPageDescriptor.mockReturnValue({ id: "base" });
    mockReadSitemapRoutePage.mockReturnValueOnce(
      Effect.succeed({
        routes: [
          {
            lastModified: "2024-01-02T00:00:00.000Z",
            path: "/search",
          },
        ],
      })
    );

    const page = await getCachedSitemapEntries({ pageId: "base" });

    assert(page._tag === "Found");
    expect(page.entries).toContainEqual({
      lastModified: "2024-01-02T00:00:00.000Z",
      url: "https://nakafa.com/en/search",
    });
  });

  it("fails the read when a route's date is not text, instead of caching it", async () => {
    mockGetSitemapPageDescriptor.mockReturnValue({ id: "base" });
    mockReadSitemapRoutePage.mockReturnValueOnce(
      Effect.succeed({
        routes: [
          {
            lastModified: DateTime.toDateUtc(
              DateTime.makeUnsafe("2024-01-02T00:00:00.000Z")
            ),
            path: "/search",
          },
        ],
      })
    );

    await expect(getCachedSitemapEntries({ pageId: "base" })).rejects.toThrow();
  });

  it("returns a missing page as data, because the cache boundary drops the error's class", async () => {
    mockReadSitemapRoutePage.mockReturnValueOnce(
      Effect.fail(new SitemapPageNotFoundError({ pageId: "material_en_p7" }))
    );

    const page = await getCachedSitemapEntries({ pageId: "material_en_p7" });

    expect(page).toEqual({ _tag: "Missing" });
  });

  it("builds each page from Convex once for each release", async () => {
    const first = await getCachedSitemapEntries({ pageId: "base" });
    const second = await getCachedSitemapEntries({ pageId: "base" });
    await getCachedSitemapEntries({ pageId: "page_en" });

    expect(second).toEqual(first);
    expect(mockReadSitemapRoutePage).toHaveBeenCalledTimes(2);

    const next = { ...activeIdentity, releaseId: "release-next" };
    activeMocks.read.mockReturnValue(Effect.succeed(next));
    activeMocks.load.mockReturnValue(Effect.succeed(next));
    await getCachedSitemapEntries({ pageId: "base" });
    await getCachedSitemapEntries({ pageId: "base" });

    expect(mockReadSitemapRoutePage).toHaveBeenCalledTimes(3);
  });

  it("keeps a missing page for the release that reported it", async () => {
    mockReadSitemapRoutePage.mockReturnValue(
      Effect.fail(new SitemapPageNotFoundError({ pageId: "material_en_p7" }))
    );

    await getCachedSitemapEntries({ pageId: "material_en_p7" });
    const page = await getCachedSitemapEntries({ pageId: "material_en_p7" });

    expect(page).toEqual({ _tag: "Missing" });
    expect(mockReadSitemapRoutePage).toHaveBeenCalledTimes(1);
  });
});
