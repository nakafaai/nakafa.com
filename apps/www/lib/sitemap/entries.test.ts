// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import type { getPathname } from "@repo/internationalization/src/navigation";
import { Effect } from "effect";
import { vi } from "vitest";
import { getSitemapEntries } from "@/lib/sitemap/entries";

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
  baseRoutes: ["/", "/search", "/contributor", "/curricula", "/quran"],
  readSitemapRoutePage: mockReadSitemapRoutePage,
}));

vi.mock("@/lib/sitemap/identity", () => ({
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
      const urls = entries.map((entry) => entry.url);

      expect(new Set(urls).size).toBe(urls.length);
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
        entries.every(
          (entry) =>
            entry.changeFrequency === undefined &&
            entry.priority === undefined &&
            entry.alternates === undefined
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

      expect(entries.map((entry) => entry.url)).toEqual([
        "https://nakafa.com/en/search",
        "https://nakafa.com/id/search",
        "https://nakafa.com/de/search",
      ]);
      expect(entries.every((entry) => entry.alternates === undefined)).toBe(
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

        expect(entries.map((entry) => entry.url)).toEqual([
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
});
