import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import {
  clearFolderChildNamesCache,
  getFolderChildNames,
  getFolderChildNamesCacheVersion,
  getNestedSlugs,
} from "@repo/contents/_lib/fs";
import { clearContentRouteManifestCache } from "@repo/contents/_lib/manifest/cache/lifecycle";
import { getContentPublicRouteManifest } from "@repo/contents/_lib/manifest/cache/public-routes";
import { getContentRouteManifest } from "@repo/contents/_lib/manifest/cache/route";
import {
  getContentIndexManifest,
  getExerciseApiParamsForLocales,
} from "@repo/contents/_lib/manifest/cache/route-params";
import {
  getContentLocaleParams,
  getContentStaticParams,
} from "@repo/contents/_lib/manifest/cache/static-params";
import { getAllSurah } from "@repo/contents/_lib/quran";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/contents/_lib/cache");
vi.mock("@repo/contents/_lib/fs");
vi.mock("@repo/contents/_lib/quran");
vi.mock("@repo/internationalization/src/routing", () => ({
  routing: {
    locales: ["en", "id"],
  },
}));

let folderCacheVersion = 0;

/** Configures manifest source mocks for one test case. */
function mockManifestSource() {
  const folderTree = new Map([
    [".", ["articles", "subject", "exercises"]],
    ["articles", ["politics"]],
    ["exercises", ["bad-category", "high-school"]],
    ["exercises/high-school", ["bad-type", "snbt"]],
    ["exercises/high-school/snbt", ["bad-material", "quantitative-knowledge"]],
    ["subject", ["bad-category", "high-school"]],
    ["subject/high-school", ["bad-grade", "10"]],
    ["subject/high-school/10", ["bad-material", "chemistry"]],
  ]);
  const nestedTree = new Map<string, string[][]>([
    ["articles", [["politics"]]],
    ["articles/politics", []],
    [
      "exercises",
      [
        ["high-school"],
        ["high-school", "snbt"],
        ["high-school", "snbt", "quantitative-knowledge"],
      ],
    ],
    ["exercises/bad-category", []],
    ["exercises/high-school", [["snbt"], ["snbt", "quantitative-knowledge"]]],
    [
      "subject",
      [
        ["high-school"],
        ["high-school", "10"],
        ["high-school", "10", "chemistry"],
      ],
    ],
    ["subject/bad-category", []],
    ["subject/high-school", [["10"], ["10", "chemistry"]]],
  ]);
  const slugs = [
    "articles/politics/article",
    "articles/not-a-category/draft",
    "subject",
    "subject/high-school/10/chemistry/green-chemistry",
    "subject/high-school/10/chemistry",
    "subject/high-school/10/chemistry/green-chemistry/definition",
    "subject/bad-category/10/chemistry/ignored",
    "subject/high-school/bad-grade/chemistry/ignored",
    "subject/high-school/10/bad-material/ignored",
    "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/1/_answer",
    "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/1/_question",
    "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/2/_question",
    "exercises/1/_question",
    "exercises/high-school/1/_question",
    "exercises/high-school/snbt/1/_question",
    "exercises/high-school/snbt/quantitative-knowledge/try-out/set-legacy/1/_question",
    "exercises/bad-category/snbt/quantitative-knowledge/try-out/2026/set-1/1/_question",
    "exercises/high-school/bad-type/quantitative-knowledge/try-out/2026/set-1/1/_question",
    "exercises/high-school/snbt/bad-material/try-out/2026/set-1/1/_question",
  ];

  vi.mocked(getFolderChildNames).mockImplementation((folder) =>
    Effect.succeed(folderTree.get(folder) ?? [])
  );
  vi.mocked(getNestedSlugs).mockImplementation(
    (folder) => nestedTree.get(folder) ?? []
  );
  vi.mocked(getMDXSlugsForLocale).mockImplementation((locale) =>
    locale === "en"
      ? slugs
      : ["articles/politics", "articles/politics/id-article"]
  );
  vi.mocked(getAllSurah).mockReturnValue([
    {
      name: {
        long: "",
        short: "",
        translation: { en: "", id: "" },
        transliteration: { en: "", id: "" },
      },
      number: 1,
      numberOfVerses: 7,
      revelation: { arab: "", en: "", id: "" },
      sequence: 5,
    },
  ]);
}

beforeEach(() => {
  folderCacheVersion = 0;
  vi.clearAllMocks();
  vi.mocked(getFolderChildNamesCacheVersion).mockImplementation(
    () => folderCacheVersion
  );
  mockManifestSource();
  clearContentRouteManifestCache();
  vi.mocked(clearFolderChildNamesCache).mockClear();
});

describe("content route manifest", () => {
  it("builds routes, redirects, index entries, and params from one source module", () => {
    const manifest = getContentRouteManifest();

    expect(manifest.quranRoutes).toEqual(["/quran/1"]);
    expect(manifest.routeRoots).toEqual(
      expect.arrayContaining(["/articles", "/subject", "/exercises", "/quran"])
    );
    expect(manifest.contentRoutes).toEqual(
      expect.arrayContaining([
        "/articles/politics",
        "/articles/politics/article",
        "/subject/high-school/10",
        "/subject/high-school/10/chemistry",
        "/subject/high-school/10/chemistry/green-chemistry/definition",
        "/exercises/high-school/snbt",
        "/exercises/high-school/snbt/quantitative-knowledge",
        "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026",
        "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1",
        "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/1",
        "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/2",
        "/quran/1",
      ])
    );
    expect(manifest.contentRoutes).not.toContain(
      "/subject/high-school/10/chemistry/green-chemistry"
    );
    expect(manifest.contentRoutes).not.toContain(
      "/exercises/high-school/snbt/quantitative-knowledge/try-out/set-legacy"
    );
    expect(manifest.redirects).toContainEqual([
      "/subject/high-school/10/chemistry/green-chemistry",
      "/subject/high-school/10/chemistry",
    ]);
    expect(manifest.indexedArticleEntries).toContainEqual({
      locale: "en",
      slug: "articles/politics/article",
    });
    expect(manifest.indexedSubjectEntries).toContainEqual({
      locale: "en",
      slug: "subject/high-school/10/chemistry/green-chemistry/definition",
    });
    expect(manifest.indexedExerciseSetEntries).toContainEqual({
      locale: "en",
      slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1",
    });
    expect(manifest.staticParams.articles).toContainEqual({
      locale: "en",
      slug: ["politics"],
    });
    expect(manifest.staticParams.exercises).toContainEqual({
      locale: "en",
      slug: "high-school/snbt/quantitative-knowledge".split("/"),
    });
    expect(manifest.localeParams).toContainEqual({
      locale: "en",
      slug: ["subject", "high-school", "10", "chemistry"],
    });
  });

  it("caches manifest scans and refreshes after folder cache invalidation", () => {
    getContentRouteManifest();
    const firstFolderReads = vi.mocked(getFolderChildNames).mock.calls.length;

    getContentRouteManifest();
    getExerciseApiParamsForLocales(["en"]);

    expect(getFolderChildNames).toHaveBeenCalledTimes(firstFolderReads);

    folderCacheVersion += 1;
    getContentRouteManifest();

    expect(vi.mocked(getFolderChildNames).mock.calls.length).toBeGreaterThan(
      firstFolderReads
    );
  });

  it("clears source and derived caches together", () => {
    getContentRouteManifest();
    clearContentRouteManifestCache();

    expect(clearFolderChildNamesCache).toHaveBeenCalledOnce();
  });

  it("builds public route fields through the route-only adapter", () => {
    const manifest = getContentPublicRouteManifest();

    expect(manifest.contentRoutes).toContain("/articles/politics/article");
    expect(manifest.publicRequestRoutes).toContain("/articles");
    expect(manifest.publicRequestRoutes).toContain(
      "/subject/high-school/10/chemistry/green-chemistry"
    );
    expect(manifest.redirects).toContainEqual([
      "/subject/high-school/10/chemistry/green-chemistry",
      "/subject/high-school/10/chemistry",
    ]);
    expect(manifest.routeRoots).toContain("/subject");
  });

  it("caches route-only adapter scans", () => {
    getContentPublicRouteManifest();
    const firstFolderReads = vi.mocked(getFolderChildNames).mock.calls.length;

    getContentPublicRouteManifest();

    expect(getFolderChildNames).toHaveBeenCalledTimes(firstFolderReads);
  });

  it("filters params through the manifest adapters", () => {
    expect(getContentStaticParams({ basePath: "articles" })).toContainEqual({
      locale: "en",
      slug: ["politics"],
    });
    expect(getContentLocaleParams()).toContainEqual({
      locale: "id",
      slug: ["articles", "politics"],
    });
    expect(getExerciseApiParamsForLocales()).toContainEqual({
      locale: "en",
      slug: "high-school/snbt/quantitative-knowledge/try-out/2026/set-1".split(
        "/"
      ),
    });
  });

  it("builds a separate manifest for non-routing locale adapters", () => {
    const params = getContentStaticParams({
      basePath: "articles",
      locales: ["de"],
    });

    expect(params).toContainEqual({ locale: "de", slug: ["politics"] });
    expect(params).not.toContainEqual({ locale: "en", slug: ["politics"] });
  });

  it("builds a separate index manifest for non-routing locale adapters", () => {
    expect(getContentIndexManifest().indexedArticleEntries).toContainEqual({
      locale: "en",
      slug: "articles/politics/article",
    });

    const manifest = getContentIndexManifest(["de"]);

    expect(manifest.indexedArticleEntries).toContainEqual({
      locale: "de",
      slug: "articles/politics/id-article",
    });
    expect(manifest.indexedArticleEntries).not.toContainEqual({
      locale: "en",
      slug: "articles/politics/article",
    });
  });

  it("returns concrete exercise API params through the manifest adapter", () => {
    const params = getExerciseApiParamsForLocales(["en"]);

    expect(params).toContainEqual({
      locale: "en",
      slug: "high-school/snbt/quantitative-knowledge/try-out/2026/set-1".split(
        "/"
      ),
    });
    expect(params).toContainEqual({
      locale: "en",
      slug: "high-school/snbt/quantitative-knowledge/try-out/2026/set-1/1".split(
        "/"
      ),
    });
  });
});
