import {
  clearFolderChildNamesCache,
  getFolderChildNames,
  getFolderChildNamesCacheVersion,
} from "@repo/contents/_lib/fs/cache";
import { getNestedSlugs } from "@repo/contents/_lib/fs/nested-slugs";
import { clearContentRouteManifestCache } from "@repo/contents/_lib/manifest/cache/lifecycle";
import { getContentPublicRouteManifest } from "@repo/contents/_lib/manifest/cache/public-routes";
import { getContentRouteManifest } from "@repo/contents/_lib/manifest/cache/route";
import { getContentRouteParamManifest } from "@repo/contents/_lib/manifest/cache/route-params";
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
    [".", ["articles", "material"]],
    ["articles", ["politics"]],
    ["material", ["lesson"]],
    ["material/lesson", ["chemistry"]],
    ["material/lesson/chemistry", ["green-chemistry"]],
    ["material/lesson/chemistry/green-chemistry", ["definition"]],
  ]);
  const nestedTree = new Map<string, string[][]>([
    ["articles", [["politics"]]],
    ["articles/politics", []],
    [
      "material",
      [
        ["lesson"],
        ["lesson", "chemistry"],
        ["lesson", "chemistry", "green-chemistry"],
        ["lesson", "chemistry", "green-chemistry", "definition"],
      ],
    ],
  ]);
  const slugs = [
    "articles/politics/article",
    "articles/not-a-category/draft",
    "material/lesson/chemistry/green-chemistry/definition",
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
      expect.arrayContaining(["/articles", "/material", "/quran"])
    );
    expect(manifest.contentRoutes).toEqual(
      expect.arrayContaining([
        "/articles/politics",
        "/articles/politics/article",
        "/material/lesson/chemistry/green-chemistry/definition",
        "/quran/1",
      ])
    );
    expect(manifest.contentRoutes).not.toContain(
      "/material/lesson/chemistry/green-chemistry"
    );
    expect(manifest.redirects).toEqual([]);
    expect(manifest.staticParams.articles).toContainEqual({
      locale: "en",
      slug: ["politics"],
    });
    expect(manifest.staticParams.material).toContainEqual({
      locale: "en",
      slug: ["lesson", "chemistry", "green-chemistry"],
    });
    expect(manifest.localeParams).toContainEqual({
      locale: "en",
      slug: [
        "material",
        "lesson",
        "chemistry",
        "green-chemistry",
        "definition",
      ],
    });
  });

  it("caches manifest scans and refreshes after folder cache invalidation", async () => {
    await getContentRouteManifest();
    const firstFolderReads = vi.mocked(getFolderChildNames).mock.calls.length;

    await getContentRouteManifest();

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
      "/material/lesson/chemistry/green-chemistry/definition"
    );
    expect(manifest.redirects).toEqual([]);
    expect(manifest.routeRoots).toContain("/material");
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
    expect(await getContentStaticParams({ basePath: "quran" })).toEqual([]);
    expect(await getContentLocaleParams()).toContainEqual({
      locale: "id",
      slug: ["articles", "politics"],
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
});
