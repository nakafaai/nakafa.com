// @vitest-environment node
import type { getPathname } from "@repo/internationalization/src/navigation";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEntries, getSitemapEntries, getUrl } from "@/lib/sitemap/entries";

const mockGetRuntimeContentRoute = vi.hoisted(() => vi.fn());
const mockGetSitemapRoutes = vi.hoisted(() => vi.fn());
const mockGetSitemapPageDescriptor = vi.hoisted(() => vi.fn());
const mockGetSitemapPageDescriptorsEffect = vi.hoisted(() => vi.fn());
const mockGetPathname = vi.hoisted(() =>
  vi.fn<typeof getPathname>(({ href, locale }) => {
    const pathname = typeof href === "string" ? href : href.pathname;
    const route = pathname.startsWith("/") ? pathname : `/${pathname}`;

    return `/${locale}${route === "/" ? "" : route}`;
  })
);

vi.mock("@/lib/content/runtime", () => ({
  getRuntimeContentRoute: mockGetRuntimeContentRoute,
}));

vi.mock("@repo/internationalization/src/navigation", () => ({
  getPathname: mockGetPathname,
}));

vi.mock("@repo/internationalization/src/routing", () => ({
  routing: {
    defaultLocale: "en",
    locales: ["en", "id"],
  },
}));

vi.mock("@/lib/sitemap/routes", () => ({
  baseRoutes: [
    "/",
    "/search",
    "/contributor",
    "/quran",
    "/subject",
    "/terms-of-service",
    "/privacy-policy",
    "/security-policy",
  ],
  getSitemapPageDescriptorsEffect: mockGetSitemapPageDescriptorsEffect,
  getSitemapPageDescriptor: mockGetSitemapPageDescriptor,
  getSitemapRoutes: mockGetSitemapRoutes,
}));

beforeEach(() => {
  mockGetRuntimeContentRoute.mockReset();
  mockGetSitemapRoutes.mockReset();
  mockGetSitemapPageDescriptor.mockReset();
  mockGetSitemapPageDescriptorsEffect.mockReset();
  mockGetPathname.mockClear();

  mockGetRuntimeContentRoute.mockReturnValue(
    Effect.succeed({
      date: new Date(2024, 0, 2).getTime(),
    })
  );
  mockGetSitemapPageDescriptor.mockReturnValue({ id: "base" });
  mockGetSitemapPageDescriptorsEffect.mockReturnValue(
    Effect.succeed([{ id: "base" }])
  );
  mockGetSitemapRoutes.mockResolvedValue([
    "/",
    "/search",
    "/articles/politics/dynastic-politics-asian-values",
    "/quran/1",
    "/subject/high-school/10",
  ]);
});

describe("sitemap entries", () => {
  it("builds localized URLs with parsed content last-modified dates", async () => {
    const entries = await Effect.runPromise(
      getEntries("/articles/politics/dynastic-politics-asian-values", {
        domain: "docs.example.com",
      })
    );

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      changeFrequency: "monthly",
      priority: 0.5,
      url: "https://docs.example.com/en/articles/politics/dynastic-politics-asian-values",
    });
    expect(entries[0]?.lastModified).toEqual(new Date(2024, 0, 2));
  });

  it("accepts content routes without a leading slash", async () => {
    const entries = await Effect.runPromise(
      getEntries("articles/politics/dynastic-politics-asian-values")
    );

    expect(entries[0]).toMatchObject({
      changeFrequency: "monthly",
      priority: 0.5,
      url: "https://nakafa.com/en/articles/politics/dynastic-politics-asian-values",
    });
  });

  it("supports object hrefs and custom domains", async () => {
    const entries = await Effect.runPromise(
      getEntries(
        { pathname: "/search" },
        {
          domain: "docs.example.com",
        }
      )
    );

    expect(getUrl({ pathname: "/search" }, "id", "docs.example.com")).toBe(
      "https://docs.example.com/id/search"
    );
    expect(entries[0]).toMatchObject({
      changeFrequency: "weekly",
      priority: 0.8,
      url: "https://docs.example.com/en/search",
    });
  });

  it("assigns SEO settings for known route families", async () => {
    await expect(Effect.runPromise(getEntries("/"))).resolves.toContainEqual(
      expect.objectContaining({
        changeFrequency: "monthly",
        lastModified: new Date("2025-01-01"),
        priority: 1,
        url: "https://nakafa.com/en",
      })
    );
    await expect(
      Effect.runPromise(getEntries("/quran/1"))
    ).resolves.toContainEqual(
      expect.objectContaining({ changeFrequency: "yearly", priority: 0.6 })
    );
    await expect(
      Effect.runPromise(getEntries("/contributor"))
    ).resolves.toContainEqual(
      expect.objectContaining({ changeFrequency: "weekly", priority: 0.8 })
    );
    await expect(
      Effect.runPromise(getEntries("/subject/university/bachelor"))
    ).resolves.toContainEqual(
      expect.objectContaining({ changeFrequency: "monthly", priority: 0.9 })
    );
    await expect(
      Effect.runPromise(getEntries("/subject/high-school/10"))
    ).resolves.toContainEqual(
      expect.objectContaining({ changeFrequency: "monthly", priority: 0.8 })
    );
    await expect(
      Effect.runPromise(getEntries("/subject/middle-school/9"))
    ).resolves.toContainEqual(
      expect.objectContaining({ changeFrequency: "monthly", priority: 0.7 })
    );
    await expect(
      Effect.runPromise(getEntries("/subject/elementary-school/6"))
    ).resolves.toContainEqual(
      expect.objectContaining({ changeFrequency: "monthly", priority: 0.6 })
    );
  });

  it("falls back when content metadata dates are invalid or unavailable", async () => {
    mockGetRuntimeContentRoute.mockReturnValueOnce(
      Effect.succeed({
        date: undefined,
      })
    );

    const invalidDateEntries = await Effect.runPromise(
      getEntries("/articles/politics/dynastic-politics-asian-values")
    );

    expect(invalidDateEntries[0]?.lastModified).toBeInstanceOf(Date);

    mockGetRuntimeContentRoute.mockReturnValueOnce(
      Effect.fail(new Error("metadata unavailable"))
    );

    await expect(
      Effect.runPromise(
        getEntries("/articles/politics/dynastic-politics-asian-values")
      )
    ).resolves.toHaveLength(2);

    await expect(
      Effect.runPromise(
        getEntries("/articles/politics/dynastic-politics-asian-values")
      )
    ).resolves.toHaveLength(2);
  });

  it("reports content metadata errors and keeps sitemap generation alive", async () => {
    const reportError = vi.fn();
    reportError.mockImplementation(() => {
      const context = reportError.mock.calls.at(-1)?.[1];

      if (context?.source === "sitemap-content-last-modified") {
        return Promise.reject(new Error("reporter failed"));
      }

      return Promise.resolve();
    });

    mockGetRuntimeContentRoute.mockReturnValueOnce(
      Effect.fail(new Error("metadata crashed"))
    );

    const entries = await Effect.runPromise(
      getEntries("/articles/politics/dynastic-politics-asian-values", {
        reportError,
      })
    );

    expect(entries).toHaveLength(2);
    expect(reportError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect(reportError.mock.calls[0]?.[1]).toMatchObject({
      source: "sitemap-content-last-modified",
    });
    expect(reportError.mock.calls[1]?.[0]).toBeInstanceOf(Error);
    expect(reportError.mock.calls[1]?.[1]).toMatchObject({
      route: "/articles/politics/dynastic-politics-asian-values",
      source: "sitemap-route-entry",
    });
  });

  it("generates sitemap entries from route and locale inputs", async () => {
    const entries = await Effect.runPromise(getSitemapEntries());
    const urls = entries.map((entry) => entry.url);

    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toContain("https://nakafa.com/en");
    expect(urls).toContain("https://nakafa.com/id");
    expect(urls).not.toContain("https://nakafa.com/en/about");
    expect(urls).not.toContain("https://nakafa.com/id/about");
    expect(urls).toContain("https://nakafa.com/id/subject/high-school/10");
  });

  it("generates unbounded submission entries across every sitemap page", async () => {
    mockGetSitemapPageDescriptorsEffect.mockReturnValueOnce(
      Effect.succeed([
        { id: "base" },
        {
          id: "content_id_subject_0",
          locale: "id",
          page: 0,
          section: "subject",
        },
      ])
    );
    mockGetSitemapPageDescriptor.mockImplementation((pageId) => {
      if (pageId === "content_id_subject_0") {
        return {
          id: "content_id_subject_0",
          locale: "id",
          page: 0,
          section: "subject",
        };
      }

      return { id: "base" };
    });
    mockGetSitemapRoutes.mockImplementation((pageId) => {
      if (pageId === "content_id_subject_0") {
        return Promise.resolve(["/subject/high-school/10"]);
      }

      return Promise.resolve(["/search"]);
    });

    const entries = await Effect.runPromise(getSitemapEntries());

    expect(entries.map((entry) => entry.url)).toEqual([
      "https://nakafa.com/en/search",
      "https://nakafa.com/id/search",
      "https://nakafa.com/id/subject/high-school/10",
    ]);
    expect(mockGetSitemapRoutes).toHaveBeenCalledWith("base");
    expect(mockGetSitemapRoutes).toHaveBeenCalledWith("content_id_subject_0");
  });

  it("keeps English content sitemap pages scoped to English URLs", async () => {
    mockGetSitemapPageDescriptor.mockReturnValueOnce({
      id: "content_en_articles_0",
      locale: "en",
      page: 0,
      section: "articles",
    });
    mockGetSitemapRoutes.mockResolvedValueOnce([
      "/articles/politics/dynastic-politics-asian-values",
    ]);

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
      locale: "id",
      page: 0,
      section: "articles",
    });
    mockGetSitemapRoutes.mockResolvedValueOnce([
      "/articles/politics/nepotism-in-political-governance",
    ]);

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
    mockGetSitemapRoutes.mockResolvedValueOnce(["/search"]);

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
});
