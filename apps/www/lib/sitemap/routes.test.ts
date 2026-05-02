import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPublicContentRedirects,
  getPublicContentRequestRoutes,
  getPublicContentRouteRoots,
  getQuranRoutes,
  getSitemapRoutes,
} from "@/lib/sitemap/routes";

const mockContentCache = vi.hoisted(() => ({
  getMDXSlugsForLocale: vi.fn(),
  slugs: [
    "articles/politics/dynastic-politics-asian-values",
    "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/1/_answer",
    "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/1/_question",
    "subject/high-school/10/chemistry/green-chemistry/definition",
    "unknown/folder",
  ],
}));

vi.mock("@repo/contents/_lib/cache", () => ({
  getMDXSlugsForLocale: mockContentCache.getMDXSlugsForLocale,
}));

vi.mock("@repo/internationalization/src/routing", () => ({
  routing: {
    defaultLocale: "en",
    locales: ["en", "id"],
  },
}));

beforeEach(() => {
  mockContentCache.getMDXSlugsForLocale.mockReset();
  mockContentCache.getMDXSlugsForLocale.mockReturnValue(mockContentCache.slugs);
});

describe("sitemap route discovery", () => {
  it("builds sitemap routes from real content entries and quran routes", () => {
    expect(getQuranRoutes()).toHaveLength(114);

    const routes = getSitemapRoutes();

    expect(routes).not.toContain("/articles");
    expect(routes).not.toContain("/exercises");
    expect(routes).not.toContain("/exercises/high-school");
    expect(routes).not.toContain("/subject/high-school");
    expect(routes).not.toContain(
      "/subject/high-school/10/chemistry/green-chemistry"
    );
    expect(routes).not.toContain("/unknown");
    expect(routes).toContain("/");
    expect(routes).toContain("/subject");
    expect(routes).toContain("/quran/114");
    expect(routes).toContain("/articles/politics");
    expect(routes).toContain(
      "/articles/politics/dynastic-politics-asian-values"
    );
    expect(routes).toContain("/exercises/high-school/snbt");
    expect(routes).toContain(
      "/exercises/high-school/snbt/quantitative-knowledge"
    );
    expect(routes).toContain(
      "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026"
    );
    expect(routes).toContain(
      "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1"
    );
    expect(routes).toContain(
      "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/1"
    );
    expect(routes).not.toContain(
      "/exercises/high-school/snbt/quantitative-knowledge/try-out"
    );
    expect(routes).toContain(
      "/subject/high-school/10/chemistry/green-chemistry/definition"
    );
    expect(getPublicContentRouteRoots()).toEqual(
      expect.arrayContaining(["/articles", "/subject", "/exercises", "/quran"])
    );
    expect(getPublicContentRouteRoots()).toHaveLength(4);
    expect(getPublicContentRequestRoutes()).toContain(
      "/subject/high-school/10/chemistry/green-chemistry"
    );
    expect(getPublicContentRequestRoutes()).toContain("/subject");
    expect(getPublicContentRequestRoutes()).toContain("/quran");
    expect(getPublicContentRedirects()).toContainEqual([
      "/subject/high-school/10/chemistry/green-chemistry",
      "/subject/high-school/10/chemistry",
    ]);
  });

  it("ignores malformed content entries instead of inventing sitemap pages", () => {
    mockContentCache.getMDXSlugsForLocale.mockReturnValue([
      "articles",
      "articles/not-a-category/draft",
      "subject/high-school/10/chemistry",
      "subject/high-school/10/chemistry/green-chemistry",
      "subject/not-a-category/10/chemistry/green-chemistry/definition",
      "subject/high-school/not-a-grade/chemistry/green-chemistry/definition",
      "subject/high-school/10/not-a-material/green-chemistry/definition",
      "training/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/1/_question",
      "exercises/1/_question",
      "exercises/high-school/snbt/quantitative-knowledge/1/_question",
      "exercises/not-a-category/snbt/quantitative-knowledge/try-out/2026/set-1/1/_question",
      "exercises/high-school/not-a-type/quantitative-knowledge/try-out/2026/set-1/1/_question",
      "exercises/high-school/snbt/not-a-material/try-out/2026/set-1/1/_question",
      "exercises/high-school/snbt/quantitative-knowledge/try-out/set-1/1/_question",
    ]);

    const routes = getSitemapRoutes();

    expect(routes).toContain("/");
    expect(routes).toContain("/subject");
    expect(routes).toContain("/quran/114");
    expect(routes).not.toContain("/articles/not-a-category");
    expect(routes).not.toContain(
      "/subject/high-school/10/chemistry/green-chemistry"
    );
    expect(getPublicContentRequestRoutes()).toContain(
      "/subject/high-school/10/chemistry/green-chemistry"
    );
    expect(getPublicContentRedirects()).toContainEqual([
      "/subject/high-school/10/chemistry/green-chemistry",
      "/subject/high-school/10/chemistry",
    ]);
    expect(routes).not.toContain(
      "/subject/high-school/10/not-a-material/green-chemistry/definition"
    );
    expect(routes).not.toContain(
      "/exercises/high-school/snbt/quantitative-knowledge"
    );
    expect(routes).not.toContain(
      "/exercises/high-school/snbt/quantitative-knowledge/try-out"
    );
    expect(routes).not.toContain(
      "/exercises/high-school/snbt/quantitative-knowledge/try-out/set-1"
    );
  });
});
