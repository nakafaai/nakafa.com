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

const mockContentFolders = vi.hoisted(() => ({
  getFolderChildNamesSync: vi.fn(),
}));

vi.mock("@repo/contents/_lib/cache", () => ({
  getMDXSlugsForLocale: mockContentCache.getMDXSlugsForLocale,
}));

vi.mock("@repo/contents/_lib/fs", () => ({
  getFolderChildNamesSync: mockContentFolders.getFolderChildNamesSync,
}));

vi.mock("@repo/internationalization/src/routing", () => ({
  routing: {
    defaultLocale: "en",
    locales: ["en", "id"],
  },
}));

function mockContentFolderTree(tree: Record<string, string[]>) {
  mockContentFolders.getFolderChildNamesSync.mockImplementation(
    (folder) => tree[folder] ?? []
  );
}

beforeEach(() => {
  mockContentCache.getMDXSlugsForLocale.mockReset();
  mockContentCache.getMDXSlugsForLocale.mockReturnValue(mockContentCache.slugs);
  mockContentFolders.getFolderChildNamesSync.mockReset();
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

  it("keeps sitemap discovery working when subject folders cannot be read", () => {
    mockContentFolders.getFolderChildNamesSync.mockReturnValue([]);

    const routes = getSitemapRoutes();

    expect(routes).toContain("/");
    expect(routes).toContain("/subject");
    expect(routes).toContain("/articles/politics");
    expect(routes).not.toContain("/subject/high-school/10/biology");
  });
});
