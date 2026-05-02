import type { getPathname } from "@repo/internationalization/src/navigation";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEntries, getSitemapEntries, getUrl } from "@/lib/sitemap/entries";

const mockGetContentMetadata = vi.hoisted(() => vi.fn());
const mockGetPathname = vi.hoisted(() =>
  vi.fn<typeof getPathname>(({ href, locale }) => {
    const pathname = typeof href === "string" ? href : href.pathname;
    const route = pathname.startsWith("/") ? pathname : `/${pathname}`;

    return `/${locale}${route === "/" ? "" : route}`;
  })
);

vi.mock("@repo/contents/_lib/metadata", () => ({
  getContentMetadata: mockGetContentMetadata,
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
    "/about",
    "/terms-of-service",
    "/privacy-policy",
    "/security-policy",
  ],
  getSitemapRoutes: () => [
    "/",
    "/search",
    "/articles/politics/dynastic-politics-asian-values",
    "/quran/1",
    "/subject/high-school/10",
  ],
}));

beforeEach(() => {
  mockGetContentMetadata.mockReset();
  mockGetPathname.mockClear();

  mockGetContentMetadata.mockReturnValue(
    Effect.succeed({
      date: "01/02/2024",
    })
  );
});

describe("sitemap entries", () => {
  it("builds localized URLs with parsed content last-modified dates", async () => {
    const entries = await getEntries(
      "/articles/politics/dynastic-politics-asian-values",
      {
        domain: "docs.example.com",
      }
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
    const entries = await getEntries(
      "articles/politics/dynastic-politics-asian-values"
    );

    expect(entries[0]).toMatchObject({
      changeFrequency: "monthly",
      priority: 0.5,
      url: "https://nakafa.com/en/articles/politics/dynastic-politics-asian-values",
    });
  });

  it("supports object hrefs and custom domains", async () => {
    const entries = await getEntries(
      { pathname: "/search" },
      {
        domain: "docs.example.com",
      }
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
    await expect(getEntries("/")).resolves.toContainEqual(
      expect.objectContaining({ changeFrequency: "monthly", priority: 1 })
    );
    await expect(getEntries("/quran/1")).resolves.toContainEqual(
      expect.objectContaining({ changeFrequency: "yearly", priority: 0.6 })
    );
    await expect(getEntries("/about")).resolves.toContainEqual(
      expect.objectContaining({ changeFrequency: "weekly", priority: 0.8 })
    );
    await expect(getEntries("/contributor")).resolves.toContainEqual(
      expect.objectContaining({ changeFrequency: "weekly", priority: 0.8 })
    );
    await expect(
      getEntries("/subject/university/bachelor")
    ).resolves.toContainEqual(
      expect.objectContaining({ changeFrequency: "monthly", priority: 0.9 })
    );
    await expect(getEntries("/subject/high-school/10")).resolves.toContainEqual(
      expect.objectContaining({ changeFrequency: "monthly", priority: 0.8 })
    );
    await expect(
      getEntries("/subject/middle-school/9")
    ).resolves.toContainEqual(
      expect.objectContaining({ changeFrequency: "monthly", priority: 0.7 })
    );
    await expect(
      getEntries("/subject/elementary-school/6")
    ).resolves.toContainEqual(
      expect.objectContaining({ changeFrequency: "monthly", priority: 0.6 })
    );
  });

  it("falls back when content metadata dates are invalid or unavailable", async () => {
    mockGetContentMetadata.mockReturnValueOnce(
      Effect.succeed({
        date: "not-a-date",
      })
    );

    const invalidDateEntries = await getEntries(
      "/articles/politics/dynastic-politics-asian-values"
    );

    expect(invalidDateEntries[0]?.lastModified).toBeInstanceOf(Date);

    mockGetContentMetadata.mockReturnValueOnce(
      Effect.fail(new Error("metadata unavailable"))
    );

    await expect(
      getEntries("/articles/politics/dynastic-politics-asian-values")
    ).resolves.toHaveLength(2);

    mockGetContentMetadata.mockImplementationOnce(() => {
      throw new Error("metadata crashed");
    });

    await expect(
      getEntries("/articles/politics/dynastic-politics-asian-values")
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

    mockGetContentMetadata.mockImplementationOnce(() => {
      throw new Error("metadata crashed");
    });

    const entries = await getEntries(
      "/articles/politics/dynastic-politics-asian-values",
      { reportError }
    );

    expect(entries).toHaveLength(2);
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        source: "sitemap-content-last-modified",
      })
    );
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        route: "/articles/politics/dynastic-politics-asian-values",
        source: "sitemap-route-entry",
      })
    );
  });

  it("generates sitemap entries from route and locale inputs", async () => {
    const entries = await getSitemapEntries();
    const urls = entries.map((entry) => entry.url);

    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toContain("https://nakafa.com/en");
    expect(urls).toContain("https://nakafa.com/id/subject/high-school/10");
  });
});
