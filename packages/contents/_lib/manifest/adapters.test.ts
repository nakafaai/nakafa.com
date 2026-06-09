import {
  clearFolderChildNamesCache,
  getFolderChildNames,
  getFolderChildNamesCacheVersion,
} from "@repo/contents/_lib/fs/cache";
import { getNestedSlugs } from "@repo/contents/_lib/fs/nested-slugs";
import { clearContentRouteManifestCache } from "@repo/contents/_lib/manifest/cache/lifecycle";
import { getContentPublicRouteManifest } from "@repo/contents/_lib/manifest/cache/public-routes";
import { getContentRouteManifest } from "@repo/contents/_lib/manifest/cache/route";
import {
  getContentRouteParamManifest,
  getExerciseApiParamsForLocales,
} from "@repo/contents/_lib/manifest/cache/route-params";
import {
  getContentLocaleParams,
  getContentStaticParamManifest,
  getContentStaticParams,
} from "@repo/contents/_lib/manifest/cache/static-params";
import {
  clearMdxSlugCache,
  getMdxSlugsForLocale,
} from "@repo/contents/_lib/mdx-slugs/cache";
import { getAllSurah } from "@repo/contents/_lib/quran";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/contents/_lib/mdx-slugs/cache");
vi.mock("@repo/contents/_lib/fs/cache");
vi.mock("@repo/contents/_lib/fs/nested-slugs");
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
    "exercises/high-school/snbt/quantitative-knowledge/try-out/set-archived/1/_question",
    "exercises/bad-category/snbt/quantitative-knowledge/try-out/2026/set-1/1/_question",
    "exercises/high-school/bad-type/quantitative-knowledge/try-out/2026/set-1/1/_question",
    "exercises/high-school/snbt/bad-material/try-out/2026/set-1/1/_question",
  ];

  vi.mocked(getFolderChildNames).mockImplementation((folder) =>
    Effect.succeed(folderTree.get(folder) ?? [])
  );
  vi.mocked(getNestedSlugs).mockImplementation((folder) =>
    Effect.succeed(nestedTree.get(folder) ?? [])
  );
  vi.mocked(getMdxSlugsForLocale).mockImplementation((locale) =>
    Effect.succeed(
      locale === "en"
        ? slugs
        : ["articles/politics", "articles/politics/id-article"]
    )
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
  vi.mocked(clearMdxSlugCache).mockReturnValue(Effect.void);
  vi.mocked(clearFolderChildNamesCache).mockReturnValue(Effect.void);
  vi.mocked(getFolderChildNamesCacheVersion).mockImplementation(() =>
    Effect.succeed(folderCacheVersion)
  );
  mockManifestSource();
  clearContentRouteManifestCache();
  vi.mocked(clearFolderChildNamesCache).mockClear();
  vi.mocked(clearMdxSlugCache).mockClear();
});

describe("content route manifest", () => {
  it("builds routes, redirects, index entries, and params from one source module", async () => {
    const manifest = await getContentRouteManifest();

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
      "/exercises/high-school/snbt/quantitative-knowledge/try-out/set-archived"
    );
    expect(manifest.redirects).toContainEqual([
      "/subject/high-school/10/chemistry/green-chemistry",
      "/subject/high-school/10/chemistry",
    ]);
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

  it("caches manifest scans and refreshes after folder cache invalidation", async () => {
    await getContentRouteManifest();
    const firstFolderReads = vi.mocked(getFolderChildNames).mock.calls.length;

    await getContentRouteManifest();
    await getExerciseApiParamsForLocales(["en"]);

    expect(getFolderChildNames).toHaveBeenCalledTimes(firstFolderReads);

    folderCacheVersion += 1;
    await getContentRouteManifest();

    expect(vi.mocked(getFolderChildNames).mock.calls.length).toBeGreaterThan(
      firstFolderReads
    );
  });

  it("clears source and derived caches together", async () => {
    await getContentRouteManifest();
    clearContentRouteManifestCache();

    expect(clearFolderChildNamesCache).toHaveBeenCalledOnce();
    expect(clearMdxSlugCache).toHaveBeenCalledOnce();
  });

  it("builds public route fields through the route-only adapter", async () => {
    const manifest = await getContentPublicRouteManifest();

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

  it("caches route-only adapter scans", async () => {
    await getContentPublicRouteManifest();
    const firstFolderReads = vi.mocked(getFolderChildNames).mock.calls.length;

    await getContentPublicRouteManifest();

    expect(getFolderChildNames).toHaveBeenCalledTimes(firstFolderReads);
  });

  it("filters params through the manifest adapters", async () => {
    expect(
      (await getContentRouteParamManifest()).staticParams.articles
    ).toContainEqual({
      locale: "en",
      slug: ["politics"],
    });
    expect(
      (await getContentStaticParamManifest()).staticParams.articles
    ).toContainEqual({
      locale: "en",
      slug: ["politics"],
    });
    expect(
      await getContentStaticParams({ basePath: "articles" })
    ).toContainEqual({
      locale: "en",
      slug: ["politics"],
    });
    expect(await getContentLocaleParams()).toContainEqual({
      locale: "id",
      slug: ["articles", "politics"],
    });
    expect(await getExerciseApiParamsForLocales()).toContainEqual({
      locale: "en",
      slug: "high-school/snbt/quantitative-knowledge/try-out/2026/set-1".split(
        "/"
      ),
    });
  });

  it("builds a separate manifest for non-routing locale adapters", async () => {
    const params = await getContentStaticParams({
      basePath: "articles",
      locales: ["de"],
    });

    expect(params).toContainEqual({ locale: "de", slug: ["politics"] });
    expect(params).not.toContainEqual({ locale: "en", slug: ["politics"] });
  });

  it("builds a separate route-param manifest for non-routing locales", async () => {
    const manifest = await getContentRouteParamManifest(["de"]);

    expect(manifest.staticParams.articles).toContainEqual({
      locale: "de",
      slug: ["politics"],
    });
    expect(manifest.staticParams.articles).not.toContainEqual({
      locale: "en",
      slug: ["politics"],
    });
  });

  it("returns concrete exercise API params through the manifest adapter", async () => {
    const params = await getExerciseApiParamsForLocales(["en"]);
    const nonRoutingParams = await getExerciseApiParamsForLocales(["de"]);

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
    expect(nonRoutingParams).toEqual([]);
  });
});
