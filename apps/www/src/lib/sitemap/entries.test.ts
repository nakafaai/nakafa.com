// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import type { getPathname } from "@repo/internationalization/src/navigation";
import { Array as Arr, Effect, HashSet } from "effect";
import { getSitemapEntries } from "@/lib/sitemap/entries";
import { SitemapPageNotFoundError } from "@/lib/sitemap/identity";

const mockReadSitemapRoutePage = vi.hoisted(() => vi.fn());
const mockGetSitemapPageDescriptor = vi.hoisted(() => vi.fn());
const mockGetPathname = vi.hoisted(() =>
  vi.fn<typeof getPathname>(({ href, locale }) => {
    const route = href.startsWith("/") ? href : `/${href}`;

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

beforeEach(() => {
  mockReadSitemapRoutePage.mockReset();
  mockGetSitemapPageDescriptor.mockReset();
  mockGetPathname.mockClear();

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

  it.effect("reads base sitemap pages", () =>
    Effect.gen(function* () {
      const entries = yield* getSitemapEntries({ pageId: "base" });

      expect(entries.length).toBeGreaterThan(0);
    })
  );

  it.effect("reads material partitions", () =>
    Effect.gen(function* () {
      mockGetSitemapPageDescriptor.mockReturnValue({
        id: "material_en_p0",
        kind: "material",
        locale: "en",
        partition: 0,
      });

      const entries = yield* getSitemapEntries({ pageId: "material_en_p0" });

      expect(entries.length).toBeGreaterThan(0);
    })
  );

  it.effect("reads unknown sitemap pages without a locale filter", () =>
    Effect.gen(function* () {
      mockGetSitemapPageDescriptor.mockReturnValue(null);

      yield* getSitemapEntries({ pageId: "unknown" });
    })
  );

  it.effect(
    "keeps a route's modification date as the text the route carries",
    () =>
      Effect.gen(function* () {
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

        const entries = yield* getSitemapEntries({ pageId: "base" });

        expect(entries).toContainEqual({
          lastModified: "2024-01-02T00:00:00.000Z",
          url: "https://nakafa.com/en/search",
        });
      })
  );

  it.effect("fails with the not-found error of a missing page", () =>
    Effect.gen(function* () {
      mockReadSitemapRoutePage.mockReturnValueOnce(
        Effect.fail(new SitemapPageNotFoundError({ pageId: "material_en_p7" }))
      );

      const error = yield* Effect.flip(
        getSitemapEntries({ pageId: "material_en_p7" })
      );

      expect(error._tag).toBe("SitemapPageNotFoundError");
    })
  );
});
