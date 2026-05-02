import type { getPathname } from "@repo/internationalization/src/navigation";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getContentRoutes,
  getEntries,
  getQuranRoutes,
  getSitemapEntries,
  getSitemapRoutes,
  getUrl,
} from "@/lib/sitemap";

const mockGetContentMetadata = vi.hoisted(() => vi.fn());
const mockGetFolderChildNames = vi.hoisted(() => vi.fn());
const mockGetPathname = vi.hoisted(() =>
  vi.fn<typeof getPathname>(({ href, locale }) => {
    const pathname = typeof href === "string" ? href : href.pathname;
    const route = pathname.startsWith("/") ? pathname : `/${pathname}`;

    return `/${locale}${route === "/" ? "" : route}`;
  })
);

vi.mock("@repo/contents/_lib/fs", () => ({
  getFolderChildNames: mockGetFolderChildNames,
}));

vi.mock("@repo/contents/_lib/metadata", () => ({
  getContentMetadata: mockGetContentMetadata,
}));

vi.mock("@repo/internationalization/src/navigation", () => ({
  getPathname: mockGetPathname,
}));

vi.mock("@repo/internationalization/src/routing", () => ({
  routing: {
    defaultLocale: "en",
    locales: ["en", "en"],
  },
}));

const folderTree = new Map([
  [".", ["articles", "exercises"]],
  ["articles", ["story"]],
  ["articles/story", []],
  ["exercises", ["high-school"]],
  ["exercises/high-school", ["snbt"]],
  ["exercises/high-school/snbt", ["quantitative-knowledge"]],
  [
    "exercises/high-school/snbt/quantitative-knowledge",
    ["semester-1", "try-out"],
  ],
  ["exercises/high-school/snbt/quantitative-knowledge/semester-1", []],
  ["exercises/high-school/snbt/quantitative-knowledge/try-out", ["2026"]],
  ["exercises/high-school/snbt/quantitative-knowledge/try-out/2026", ["set-1"]],
  ["exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1", []],
]);

beforeEach(() => {
  mockGetContentMetadata.mockReset();
  mockGetFolderChildNames.mockReset();
  mockGetPathname.mockClear();

  mockGetContentMetadata.mockReturnValue(
    Effect.succeed({
      date: "01/02/2024",
    })
  );
  mockGetFolderChildNames.mockImplementation((path) =>
    Effect.succeed(folderTree.get(path) ?? [])
  );
});

describe("sitemap route discovery", () => {
  it("builds recursive content, quran, and filtered sitemap routes", () => {
    expect(getQuranRoutes()).toHaveLength(114);
    expect(getContentRoutes("articles")).toEqual([
      "/articles",
      "/articles/story",
    ]);

    const routes = getSitemapRoutes();

    expect(routes).toContain("/");
    expect(routes).toContain("/quran/114");
    expect(routes).toContain("/articles/story");
    expect(routes).toContain(
      "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1"
    );
    expect(routes).not.toContain(
      "/exercises/high-school/snbt/quantitative-knowledge/try-out"
    );
  });

  it("keeps the current route when content folder traversal fails", () => {
    mockGetFolderChildNames.mockReturnValueOnce(
      Effect.fail(new Error("folder unavailable"))
    );

    expect(getContentRoutes()).toEqual(["/"]);
  });
});

describe("sitemap entries", () => {
  it("builds localized URLs with parsed content last-modified dates", async () => {
    const entries = await getEntries("/articles/story", {
      domain: "docs.example.com",
    });

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      changeFrequency: "monthly",
      priority: 0.5,
      url: "https://docs.example.com/en/articles/story",
    });
    expect(entries[0]?.lastModified).toEqual(new Date(2024, 0, 2));
  });

  it("accepts content routes without a leading slash", async () => {
    const entries = await getEntries("articles/story");

    expect(entries[0]).toMatchObject({
      changeFrequency: "monthly",
      priority: 0.5,
      url: "https://nakafa.com/en/articles/story",
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

    const invalidDateEntries = await getEntries("/articles/story");

    expect(invalidDateEntries[0]?.lastModified).toBeInstanceOf(Date);

    mockGetContentMetadata.mockReturnValueOnce(
      Effect.fail(new Error("metadata unavailable"))
    );

    await expect(getEntries("/articles/story")).resolves.toHaveLength(2);

    mockGetContentMetadata.mockImplementationOnce(() => {
      throw new Error("metadata crashed");
    });

    await expect(getEntries("/articles/story")).resolves.toHaveLength(2);
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

    const entries = await getEntries("/articles/story", { reportError });

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
        route: "/articles/story",
        source: "sitemap-route-entry",
      })
    );
  });

  it("deduplicates generated sitemap entries", async () => {
    const entries = await getSitemapEntries();
    const urls = entries.map((entry) => entry.url);

    expect(new Set(urls).size).toBe(urls.length);
  });
});
