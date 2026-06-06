// @vitest-environment node

import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSitemapRouteCache,
  getPublicContentRedirects,
  getPublicContentRequestRoutes,
  getPublicContentRouteRoots,
  getQuranRoutes,
  getSitemapRoutes,
} from "@/lib/sitemap/routes";

const mockContentCache = vi.hoisted(() => ({
  clearMdxSlugCache: vi.fn(),
  getMdxSlugsForLocale: vi.fn(),
  slugs: [
    "articles/politics/dynastic-politics-asian-values",
    "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/1/_answer",
    "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/1/_question",
    "subject/high-school/10/chemistry/green-chemistry/definition",
    "unknown/folder",
  ],
}));

const mockContentFolders = vi.hoisted(() => ({
  clearFolderChildNamesCache: vi.fn(),
  getFolderChildNames: vi.fn(),
  getNestedSlugs: vi.fn(),
}));

vi.mock("@repo/contents/_lib/mdx-slugs/cache", () => ({
  clearMdxSlugCache: () => {
    mockContentCache.clearMdxSlugCache();
    return Effect.void;
  },
  getMdxSlugsForLocale: (locale: string) =>
    Effect.succeed(mockContentCache.getMdxSlugsForLocale(locale)),
}));

vi.mock("@repo/contents/_lib/fs/cache", async () => {
  const { Effect: EffectModule } = await import("effect");

  return {
    clearFolderChildNamesCache: () => {
      mockContentFolders.clearFolderChildNamesCache();
      return EffectModule.void;
    },
    getFolderChildNames: mockContentFolders.getFolderChildNames,
    getFolderChildNamesCacheVersion: vi.fn(() => EffectModule.succeed(0)),
  };
});

vi.mock("@repo/contents/_lib/fs/nested-slugs", async () => {
  const { Effect: EffectModule } = await import("effect");

  return {
    getNestedSlugs: (folder: string) =>
      EffectModule.succeed(mockContentFolders.getNestedSlugs(folder)),
  };
});

vi.mock("@repo/internationalization/src/routing", () => ({
  routing: {
    defaultLocale: "en",
    locales: ["en", "id"],
  },
}));

function mockContentFolderTree(tree: Record<string, string[]>) {
  mockContentFolders.getFolderChildNames.mockImplementation((folder) =>
    Effect.succeed(tree[folder] ?? [])
  );
}

beforeEach(() => {
  mockContentCache.clearMdxSlugCache.mockReset();
  mockContentFolders.clearFolderChildNamesCache.mockReset();
  clearSitemapRouteCache();
  mockContentCache.clearMdxSlugCache.mockClear();
  mockContentFolders.clearFolderChildNamesCache.mockClear();
  mockContentCache.getMdxSlugsForLocale.mockReset();
  mockContentCache.getMdxSlugsForLocale.mockReturnValue(mockContentCache.slugs);
  mockContentFolders.getFolderChildNames.mockReset();
  mockContentFolders.getNestedSlugs.mockReset();
  mockContentFolders.getNestedSlugs.mockReturnValue([]);
  mockContentFolderTree({
    exercises: ["middle-school", "high-school"],
    "exercises/high-school": ["snbt"],
    "exercises/high-school/snbt": ["quantitative-knowledge"],
    "exercises/middle-school": ["grade-9"],
    "exercises/middle-school/grade-9": ["mathematics"],
    subject: ["high-school"],
    "subject/high-school": ["10"],
    "subject/high-school/10": ["biology", "chemistry", "history"],
  });
});

describe("sitemap route discovery", () => {
  it("clears folder scans when clearing sitemap route discovery", () => {
    clearSitemapRouteCache();

    expect(
      mockContentFolders.clearFolderChildNamesCache
    ).toHaveBeenCalledOnce();
    expect(mockContentCache.clearMdxSlugCache).toHaveBeenCalledOnce();
  });

  it("builds sitemap routes from real content entries and quran routes", async () => {
    expect(await getQuranRoutes()).toHaveLength(114);

    const routes = await getSitemapRoutes();

    expect(routes).not.toContain("/articles");
    expect(routes).not.toContain("/exercises");
    expect(routes).not.toContain("/exercises/high-school");
    expect(routes).not.toContain("/subject/high-school");
    expect(routes).not.toContain(
      "/subject/high-school/10/chemistry/green-chemistry"
    );
    expect(routes).not.toContain("/unknown");
    expect(routes).toContain("/");
    expect(routes).not.toContain("/about");
    expect(routes).toContain("/subject");
    expect(routes).toContain("/quran/114");
    expect(routes).toContain("/articles/politics");
    expect(routes).toContain(
      "/articles/politics/dynastic-politics-asian-values"
    );
    expect(routes).toContain("/exercises/middle-school/grade-9");
    expect(routes).toContain("/exercises/middle-school/grade-9/mathematics");
    expect(routes).toContain("/subject/high-school/10");
    expect(routes).toContain("/subject/high-school/10/biology");
    expect(routes).toContain("/subject/high-school/10/history");
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
    expect(await getPublicContentRouteRoots()).toEqual(
      expect.arrayContaining(["/articles", "/subject", "/exercises", "/quran"])
    );
    expect(await getPublicContentRouteRoots()).toHaveLength(4);
    expect(await getPublicContentRequestRoutes()).toContain(
      "/subject/high-school/10/chemistry/green-chemistry"
    );
    expect(await getPublicContentRequestRoutes()).toContain("/subject");
    expect(await getPublicContentRequestRoutes()).toContain("/quran");
    expect(await getPublicContentRedirects()).toContainEqual([
      "/subject/high-school/10/chemistry/green-chemistry",
      "/subject/high-school/10/chemistry",
    ]);
    expect(mockContentCache.getMdxSlugsForLocale).toHaveBeenCalledTimes(2);
  });

  it("ignores malformed content entries instead of inventing sitemap pages", async () => {
    mockContentCache.getMdxSlugsForLocale.mockReturnValue([
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
    mockContentFolderTree({
      exercises: ["not-a-category", "middle-school"],
      "exercises/not-a-category": ["not-a-type"],
      "exercises/middle-school": ["not-a-type", "grade-9"],
      "exercises/middle-school/grade-9": ["not-a-material"],
      subject: ["not-a-category", "high-school"],
      "subject/not-a-category": ["not-a-grade"],
      "subject/high-school": ["not-a-grade", "10"],
      "subject/high-school/10": ["not-a-material"],
    });

    const routes = await getSitemapRoutes();

    expect(routes).toContain("/");
    expect(routes).not.toContain("/about");
    expect(routes).toContain("/subject");
    expect(routes).toContain("/quran/114");
    expect(routes).not.toContain("/articles/not-a-category");
    expect(routes).not.toContain(
      "/subject/high-school/10/chemistry/green-chemistry"
    );
    expect(await getPublicContentRequestRoutes()).toContain(
      "/subject/high-school/10/chemistry/green-chemistry"
    );
    expect(await getPublicContentRedirects()).toContainEqual([
      "/subject/high-school/10/chemistry/green-chemistry",
      "/subject/high-school/10/chemistry",
    ]);
    expect(routes).not.toContain(
      "/subject/high-school/10/not-a-material/green-chemistry/definition"
    );
    expect(routes).not.toContain("/subject/high-school/10/not-a-material");
    expect(routes).not.toContain(
      "/exercises/high-school/snbt/quantitative-knowledge"
    );
    expect(routes).not.toContain(
      "/exercises/high-school/snbt/quantitative-knowledge/try-out"
    );
    expect(routes).not.toContain(
      "/exercises/high-school/snbt/quantitative-knowledge/try-out/set-1"
    );
    expect(routes).not.toContain("/exercises/middle-school/not-a-type");
    expect(routes).not.toContain(
      "/exercises/middle-school/grade-9/not-a-material"
    );
  });

  it("keeps sitemap discovery working when subject folders cannot be read", async () => {
    mockContentFolders.getFolderChildNames.mockReturnValue(Effect.succeed([]));

    const routes = await getSitemapRoutes();

    expect(routes).toContain("/");
    expect(routes).not.toContain("/about");
    expect(routes).toContain("/subject");
    expect(routes).toContain("/articles/politics");
    expect(routes).not.toContain("/subject/high-school/10/biology");
  });
});
