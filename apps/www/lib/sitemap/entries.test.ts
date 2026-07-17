// @vitest-environment node
import type { getPathname } from "@repo/internationalization/src/navigation";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
    locales: ["en", "id"],
    pathnames: {
      "/curricula": {
        en: "/curriculum",
        id: "/kurikulum",
      },
    },
  },
}));

vi.mock("@/lib/sitemap/routes", () => ({
  baseRoutes: [
    "/",
    "/search",
    "/contributor",
    "/curricula",
    "/quran",
    "/terms-of-service",
    "/privacy-policy",
    "/security-policy",
  ],
  getSitemapPageDescriptor: mockGetSitemapPageDescriptor,
  readSitemapRoutePage: mockReadSitemapRoutePage,
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
          lastModified: new Date(2024, 0, 2).getTime(),
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
  it("generates sitemap entries from route and locale inputs", async () => {
    const entries = await Effect.runPromise(
      getSitemapEntries({ pageId: "base" })
    );
    const urls = entries.map((entry) => entry.url);

    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toContain("https://nakafa.com/en");
    expect(urls).toContain("https://nakafa.com/id");
    expect(urls).not.toContain("https://nakafa.com/en/about");
    expect(urls).not.toContain("https://nakafa.com/id/about");
    expect(urls).toContain(
      "https://nakafa.com/en/subjects/chemistry/green-chemistry/definition"
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        changeFrequency: "monthly",
        priority: 0.8,
        url: "https://nakafa.com/en/subjects/chemistry/green-chemistry/definition",
      })
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        changeFrequency: "monthly",
        priority: 0.7,
        url: "https://nakafa.com/en/curriculum/merdeka/class-10/mathematics/integral",
      })
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        changeFrequency: "monthly",
        priority: 0.6,
        url: "https://nakafa.com/en/try-out/indonesia/snbt/2027/set-1/quantitative-knowledge",
      })
    );
  });

  it("keeps English content sitemap pages scoped to English URLs", async () => {
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
            lastModified: new Date(2024, 0, 2).getTime(),
            path: "/articles/politics/dynastic-politics-asian-values",
          },
        ],
      })
    );

    const entries = await Effect.runPromise(
      getSitemapEntries({ pageId: "content_en_articles_0" })
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]?.url).toBe(
      "https://nakafa.com/en/articles/politics/dynastic-politics-asian-values"
    );
    expect(entries[0]?.alternates?.languages).toEqual({
      en: "https://nakafa.com/en/articles/politics/dynastic-politics-asian-values",
      "x-default":
        "https://nakafa.com/en/articles/politics/dynastic-politics-asian-values",
    });
  });

  it("keeps Indonesian content sitemap pages scoped to Indonesian URLs", async () => {
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
            lastModified: new Date(2024, 0, 2).getTime(),
            path: "/articles/politics/nepotism-in-political-governance",
          },
        ],
      })
    );

    const entries = await Effect.runPromise(
      getSitemapEntries({ pageId: "content_id_articles_0" })
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]?.url).toBe(
      "https://nakafa.com/id/articles/politics/nepotism-in-political-governance"
    );
    expect(entries[0]?.alternates?.languages).toEqual({
      id: "https://nakafa.com/id/articles/politics/nepotism-in-political-governance",
    });
  });

  it("keeps base sitemap pages localized across supported locales", async () => {
    mockGetSitemapPageDescriptor.mockReturnValueOnce({ id: "base" });
    mockReadSitemapRoutePage.mockReturnValueOnce(
      Effect.succeed({ routes: [{ path: "/search" }] })
    );

    const entries = await Effect.runPromise(
      getSitemapEntries({ pageId: "base" })
    );

    expect(entries.map((entry) => entry.url)).toEqual([
      "https://nakafa.com/en/search",
      "https://nakafa.com/id/search",
    ]);
    expect(entries[0]?.alternates?.languages).toEqual({
      en: "https://nakafa.com/en/search",
      id: "https://nakafa.com/id/search",
      "x-default": "https://nakafa.com/en/search",
    });
  });

  it("localizes the curriculum index route in base sitemap entries", async () => {
    mockGetSitemapPageDescriptor.mockReturnValueOnce({ id: "base" });
    mockReadSitemapRoutePage.mockReturnValueOnce(
      Effect.succeed({ routes: [{ path: "/curricula" }] })
    );

    const entries = await Effect.runPromise(
      getSitemapEntries({ pageId: "base" })
    );

    expect(entries.map((entry) => entry.url)).toEqual([
      "https://nakafa.com/en/curriculum",
      "https://nakafa.com/id/kurikulum",
    ]);
  });
});
