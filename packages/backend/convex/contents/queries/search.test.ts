import { api, internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { NAKAFA_CONTENT_BASE_URL } from "@repo/backend/convex/contents/constants";
import { CONTENT_SEARCH_MAX_OFFSET } from "@repo/backend/convex/contents/helpers/search/constants";
import { readContentSearchDocuments } from "@repo/backend/convex/contents/helpers/search/read";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import type { Locale } from "@repo/contents/_types/content";
import type { SourceRegistryRoot } from "@repo/contents/_types/graph/schema";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { findPublicContentRouteBySourcePath } from "@repo/contents/_types/route/content";
import { Effect, Option } from "effect";
import { describe, expect, it } from "vitest";

/** Inserts a content search fixture with graph identity as product identity. */
async function insertContentSearch(
  ctx: MutationCtx,
  fixture: {
    contentHash: string;
    description: string;
    locale: Locale;
    markdown_url?: string;
    route: string;
    section: SourceRegistryRoot;
    sourcePath?: string;
    syncedAt: number;
    text: string;
    title: string;
    url?: string;
  }
) {
  const sourcePath = fixture.sourcePath ?? fixture.route;
  const publicPath = getPublicSearchPath(fixture.locale, sourcePath);
  const identity = createLearningGraphIdentityFromRoute({
    locale: fixture.locale,
    route: sourcePath,
  });

  if (!identity) {
    expect.fail(`Expected graph identity for ${sourcePath}.`);
  }

  await ctx.db.insert("contentSearch", {
    ...fixture,
    ...identity,
    content_id: identity.assetId,
    markdown_url:
      fixture.markdown_url ??
      `${NAKAFA_CONTENT_BASE_URL}/${fixture.locale}/${publicPath}.md`,
    route: publicPath,
    sourcePath,
    url:
      fixture.url ??
      `${NAKAFA_CONTENT_BASE_URL}/${fixture.locale}/${publicPath}`,
  });
}

/**
 * Resolves one source path to the localized public search route when projected.
 * Article fixtures already use their public route shape and bypass material
 * route projection so large pagination tests stay focused on Convex search.
 */
function getPublicSearchPath(locale: Locale, sourcePath: string) {
  if (sourcePath.startsWith("articles/")) {
    return sourcePath;
  }

  const route = Effect.runSync(
    findPublicContentRouteBySourcePath(sourcePath, locale)
  );

  return Option.match(route, {
    onNone: () => sourcePath,
    onSome: (publicRoute) => publicRoute.publicPath,
  });
}

/** Returns the graph asset ID for a search route fixture. */
function searchContentId(locale: Locale, route: string) {
  const identity = createLearningGraphIdentityFromRoute({ locale, route });

  if (!identity) {
    expect.fail(`Expected graph identity for ${route}.`);
  }

  return identity.assetId;
}

describe("contents/queries/search:search", () => {
  it("searches title and body text with locale and section filters", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await insertContentSearch(ctx, {
        contentHash: "hash-rational",
        description: "Pelajari fungsi rasional.",
        locale: "id",
        route:
          "material/lesson/mathematics/function-modeling/rational-function",
        section: "material",
        syncedAt: 1,
        text: "kelas 11 matematika pemodelan fungsi penyebut domain asimtot",
        title: "Fungsi Rasional",
      });
      await insertContentSearch(ctx, {
        contentHash: "hash-domain",
        description: "Pelajari domain dan range.",
        locale: "id",
        route:
          "material/lesson/mathematics/function-modeling/domain-codomain-range",
        section: "material",
        syncedAt: 1,
        text: "fungsi rasional muncul dalam contoh batas input dan output",
        title: "Domain, Kodomain, dan Range",
      });
      await insertContentSearch(ctx, {
        contentHash: "hash-en",
        description: "Learn rational functions.",
        locale: "en",
        route:
          "material/lesson/mathematics/function-modeling/rational-function",
        section: "material",
        syncedAt: 1,
        text: "grade 11 mathematics rational function",
        title: "Rational Function",
      });
    });

    const titleResult = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["fungsi rasional kelas 11"],
      section: "material",
    });
    const bodyResult = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["batas input output"],
      section: "material",
    });

    expect(titleResult.items.map((item) => item.title)).toEqual([
      "Fungsi Rasional",
      "Domain, Kodomain, dan Range",
    ]);
    expect(titleResult.items[0]).toEqual(
      expect.objectContaining({
        excerpt: expect.stringContaining("kelas 11"),
      })
    );
    expect(bodyResult.items).toEqual([
      expect.objectContaining({
        content_id: searchContentId(
          "id",
          "material/lesson/mathematics/function-modeling/domain-codomain-range"
        ),
        excerpt: expect.stringContaining("batas input"),
      }),
    ]);
    expect(bodyResult.items[0].excerpt).not.toContain("<mark>");
  });

  it("searches route tokens without leaking route strings into excerpts", async () => {
    const t = createConvexTestWithBetterAuth();
    const sourcePath =
      "material/lesson/mathematics/exponential-logarithm/logarithm-definition";
    const publicPath = getPublicSearchPath("id", sourcePath);

    await t.mutation(async (ctx) => {
      await insertContentSearch(ctx, {
        contentHash: "hash-logarithm",
        description: "Memahami bentuk dasar logaritma.",
        locale: "id",
        route: sourcePath,
        section: "material",
        syncedAt: 1,
        text: "Definisi Logaritma menjelaskan pangkat yang dibutuhkan.",
        title: "Definisi Logaritma",
      });
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 5,
      locale: "id",
      offset: 0,
      queries: [publicPath],
      section: "material",
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        content_id: searchContentId("id", sourcePath),
        excerpt: expect.stringContaining("pangkat"),
      }),
    ]);
    expect(result.items[0].excerpt).not.toContain("material/lesson");
    expect(result.items[0].excerpt).not.toContain("exponential-logarithm");
  });

  it("resolves exact routes through persisted route catalog content IDs", async () => {
    const t = createConvexTestWithBetterAuth();
    const sourcePath =
      "material/lesson/mathematics/exponential-logarithm/logarithm-definition";
    const route = getPublicSearchPath("id", sourcePath);
    const identity = createLearningGraphIdentityFromRoute({
      locale: "id",
      route: sourcePath,
    });

    if (!identity) {
      expect.fail(`Expected graph identity for ${sourcePath}.`);
    }

    const catalogAssetId = `${identity.assetId}:catalog`;
    const catalogGraph = {
      ...identity,
      assetId: catalogAssetId,
    };

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentRoutes", {
        ...catalogGraph,
        authors: [],
        contentHash: "hash-logarithm",
        content_id: catalogAssetId,
        kind: "curriculum-lesson",
        locale: "id",
        markdown: true,
        route,
        section: "material",
        sourcePath,
        syncedAt: 1,
        title: "Definisi Logaritma",
      });
      await ctx.db.insert("contentSearch", {
        ...catalogGraph,
        contentHash: "hash-logarithm",
        content_id: catalogAssetId,
        description: "Memahami bentuk dasar logaritma.",
        locale: "id",
        markdown_url: `https://nakafa.com/id/${route}.md`,
        route,
        section: "material",
        sourcePath,
        syncedAt: 1,
        text: "Definisi Logaritma menjelaskan pangkat yang dibutuhkan.",
        title: "Definisi Logaritma",
        url: `https://nakafa.com/id/${route}`,
      });
    });

    const documents = await t.query(
      async (ctx) =>
        await readContentSearchDocuments(
          ctx,
          {
            limit: 1,
            locale: "id",
            offset: 0,
            queries: [route],
            section: "material",
          },
          [route],
          0
        )
    );

    expect(documents.map((document) => document.content_id)).toEqual([
      catalogAssetId,
    ]);
  });

  it("prioritizes try-out context over generic section titles", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await insertContentSearch(ctx, {
        contentHash: "hash-english-section",
        description: "",
        locale: "id",
        route: "try-out/indonesia/snbt/2027/set-2/english-language",
        section: "tryout",
        syncedAt: 1,
        text: "english-language try-out set-2 reading passage",
        title: "Bahasa Inggris",
      });
      await insertContentSearch(ctx, {
        contentHash: "hash-quantitative-section",
        description: "SMA SNBT Pengetahuan Kuantitatif try out 2026 set 2",
        locale: "id",
        route: "try-out/indonesia/snbt/2027/set-2/quantitative-knowledge",
        section: "tryout",
        syncedAt: 1,
        text: "quantitative-knowledge Pengetahuan Kuantitatif try-out try out 2026 set-2 set 2 fungsi tangga",
        title: "Pengetahuan Kuantitatif",
      });
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["SNBT Pengetahuan Kuantitatif try out 2026 set 2"],
      section: "tryout",
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        content_id: searchContentId(
          "id",
          "try-out/indonesia/snbt/2027/set-2/quantitative-knowledge"
        ),
      })
    );
  });

  it("prefers metadata-matching try-out section rows over generic body hits", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await insertContentSearch(ctx, {
        contentHash: "hash-language-section",
        description: "",
        locale: "id",
        route: "try-out/indonesia/snbt/2027/set-1/indonesian-language",
        section: "tryout",
        syncedAt: 1,
        text: "Bagian bacaan yang menyebut pola bilangan sebagai contoh.",
        title: "Bahasa Indonesia",
      });
      await insertContentSearch(ctx, {
        contentHash: "hash-math-section",
        description: "SNBT Penalaran Matematika Try Out 2026 Set 1 20 soal",
        locale: "id",
        route: "try-out/indonesia/snbt/2027/set-1/mathematical-reasoning",
        section: "tryout",
        syncedAt: 1,
        text: "Latihan pola bilangan untuk penalaran matematika.",
        title: "SNBT Penalaran Matematika Try Out 2026 Set 1",
      });
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["pola bilangan penalaran matematika"],
      section: "tryout",
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        content_id: searchContentId(
          "id",
          "try-out/indonesia/snbt/2027/set-1/mathematical-reasoning"
        ),
      })
    );
  });

  it("does not let grade numbers dominate try-out topic searches", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await insertContentSearch(ctx, {
        contentHash: "hash-general-reasoning-section",
        description: "SMA SNBT Penalaran Umum Try Out 2026 Set 3 Nomor 11",
        locale: "id",
        route: "try-out/indonesia/snbt/2027/set-3/general-reasoning",
        section: "tryout",
        syncedAt: 1,
        text: "Bagian umum nomor 11.",
        title: "SNBT Penalaran Umum Try Out 2026 Set 3",
      });
      await insertContentSearch(ctx, {
        contentHash: "hash-rational-section",
        description: "SMA TKA Matematika Try Out 2026 Set 1 20 soal",
        locale: "id",
        route: "try-out/indonesia/tka/set-1/mathematics",
        section: "tryout",
        syncedAt: 1,
        text: "Latihan fungsi rasional kelas 11.",
        title: "TKA Matematika Try Out 2026 Set 1",
      });
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["fungsi rasional kelas 11"],
      section: "tryout",
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        content_id: searchContentId(
          "id",
          "try-out/indonesia/tka/set-1/mathematics"
        ),
      })
    );
  });

  it("drops weak try-out hits when only one semantic query token matches", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await insertContentSearch(ctx, {
        contentHash: "hash-class-section",
        description: "SMA SNBT Penalaran Umum Try Out 2026 Set 3 Nomor 11",
        locale: "id",
        route: "try-out/indonesia/snbt/2027/set-3/general-reasoning",
        section: "tryout",
        syncedAt: 1,
        text: "Semua siswa kelas 9 mengikuti ujian sekolah.",
        title: "SNBT Penalaran Umum Try Out 2026 Set 3 Soal 11",
      });
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["fungsi rasional kelas 11"],
      section: "tryout",
    });

    expect(result.items).toEqual([]);
  });

  it("searches multiple unique query variants in one bounded request", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await insertContentSearch(ctx, {
        contentHash: "hash-mass",
        description: "Pelajari hukum kekekalan massa.",
        locale: "id",
        route:
          "material/lesson/chemistry/basic-chemistry-laws/mass-conservation-law",
        section: "material",
        syncedAt: 1,
        text: "kimia kelas 10 reaksi tertutup massa zat tetap",
        title: "Hukum Kekekalan Massa",
      });
      await insertContentSearch(ctx, {
        contentHash: "hash-stoichiometry",
        description: "Pelajari stoikiometri.",
        locale: "id",
        route: "material/lesson/chemistry/stoichiometry/introduction",
        section: "material",
        syncedAt: 1,
        text: "perhitungan kimia mol massa reaksi",
        title: "Stoikiometri",
      });
      await insertContentSearch(ctx, {
        contentHash: "hash-mass-application",
        description: "Latihan tambahan hukum kekekalan massa.",
        locale: "id",
        route:
          "material/lesson/chemistry/basic-chemistry-laws/mass-application",
        section: "material",
        syncedAt: 1,
        text: "hukum kekekalan massa contoh lanjutan",
        title: "Aplikasi Massa",
      });
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 2,
      locale: "id",
      offset: 0,
      queries: ["hukum kekekalan massa", "stoikiometri"],
      section: "material",
    });

    expect(result.items.map((item) => item.title)).toEqual([
      "Hukum Kekekalan Massa",
      "Stoikiometri",
    ]);
  });

  it("browses a stable bounded list when no query is provided", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await insertContentSearch(ctx, {
        contentHash: "hash-b",
        description: "",
        locale: "id",
        route: "articles/science/b",
        section: "articles",
        syncedAt: 1,
        text: "Beta",
        title: "Beta",
      });
      await insertContentSearch(ctx, {
        contentHash: "hash-a",
        description: "",
        locale: "id",
        route: "articles/science/a",
        section: "articles",
        syncedAt: 1,
        text: "Alpha",
        title: "Alpha",
      });
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 1,
      locale: "id",
      offset: 0,
      section: "articles",
    });

    expect(result).toMatchObject({
      count: 1,
      has_more: true,
      next_offset: 1,
    });
    expect(result.items[0].title).toBe("Alpha");
  });

  it("does not return a follow-up offset beyond the accepted maximum", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      for (let index = 0; index <= CONTENT_SEARCH_MAX_OFFSET + 10; index += 1) {
        const title = `Search Cap ${index.toString().padStart(4, "0")}`;

        await insertContentSearch(ctx, {
          contentHash: `hash-search-cap-${index}`,
          description: "",
          locale: "id",
          route: `articles/search-cap/${index}`,
          section: "articles",
          syncedAt: 1,
          text: "searchcap pagination",
          title,
        });
      }
    });

    const offset = CONTENT_SEARCH_MAX_OFFSET - 10;
    const browseResult = await t.query(api.contents.queries.search.search, {
      limit: 20,
      locale: "id",
      offset,
      section: "articles",
    });
    const queryResult = await t.query(api.contents.queries.search.search, {
      limit: 20,
      locale: "id",
      offset,
      queries: ["searchcap"],
      section: "articles",
    });

    expect(browseResult).toMatchObject({
      count: 20,
      has_more: false,
    });
    expect(queryResult).toMatchObject({
      count: 20,
      has_more: false,
    });
  });

  it("removes article search rows when stale synced content is deleted", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(internal.contentSync.mutations.articles.bulkSyncArticles, {
      articles: [
        {
          articleSlug: "valid-article",
          authors: [],
          body: "body about searchable deletion",
          category: "politics",
          contentHash: "hash-valid",
          date: 1,
          description: "Searchable article",
          locale: "id",
          official: false,
          references: [],
          slug: "articles/science/valid-article",
          title: "Valid Article",
        },
      ],
    });

    const articleId = await t.query(async (ctx) => {
      const article = await ctx.db
        .query("articleContents")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", "id").eq("slug", "articles/science/valid-article")
        )
        .unique();

      if (!article) {
        expect.fail("Expected synced article.");
      }

      return article._id;
    });

    await t.mutation(
      internal.contentSync.mutations.articles.deleteStaleArticles,
      {
        articleIds: [articleId],
      }
    );

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["searchable deletion"],
    });

    expect(result.items).toEqual([]);
  });

  it("returns Quran rows written by the Quran search sync mutation", async () => {
    const t = createConvexTestWithBetterAuth();
    const route = "quran/1";
    const identity = createLearningGraphIdentityFromRoute({
      locale: "id",
      route,
    });

    if (!identity) {
      expect.fail(`Expected graph identity for ${route}.`);
    }

    const catalogGraph = {
      alignmentId: `${identity.alignmentId}:catalog`,
      assetId: `${identity.assetId}:catalog`,
      conceptId: `${identity.conceptId}:catalog`,
      learningObjectId: `${identity.learningObjectId}:catalog`,
      lensId: `${identity.lensId}:catalog`,
    };

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentRoutes", {
        ...catalogGraph,
        authors: [],
        contentHash: "route-hash-fatihah",
        content_id: catalogGraph.assetId,
        kind: "quran-surah",
        locale: "id",
        markdown: true,
        route,
        section: "quran",
        sourcePath: route,
        syncedAt: 1,
        title: "1. Al-Fatihah",
      });
      await ctx.db.insert("contentSearch", {
        ...identity,
        contentHash: "old-hash-fatihah",
        content_id: identity.assetId,
        description: "Old Pembukaan",
        locale: "id",
        markdown_url: `https://nakafa.com/id/${route}.md`,
        route,
        section: "quran",
        sourcePath: route,
        syncedAt: 1,
        text: "old stale search row",
        title: "Old Al-Fatihah",
        url: `https://nakafa.com/id/${route}`,
      });
    });

    const summary = await t.mutation(
      internal.contents.mutations.search.bulkSyncQuranSearch,
      {
        documents: [
          {
            contentHash: "hash-fatihah",
            description: "Pembukaan",
            locale: "id",
            route,
            text: "Al-Fatihah pembukaan rahmat petunjuk",
            title: "1. Al-Fatihah",
          },
        ],
      }
    );

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["petunjuk"],
      section: "quran",
    });
    const rows = await t.query(
      async (ctx) =>
        await ctx.db
          .query("contentSearch")
          .withIndex("by_locale_and_route", (q) =>
            q.eq("locale", "id").eq("route", route)
          )
          .take(10)
    );

    expect(summary).toEqual({ created: 1, unchanged: 0, updated: 0 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        ...catalogGraph,
        content_id: catalogGraph.assetId,
      })
    );
    expect(result.items).toEqual([
      expect.objectContaining({
        content_id: catalogGraph.assetId,
        section: "quran",
        title: "1. Al-Fatihah",
      }),
    ]);
  });

  it("rejects Quran search sync without a route graph projection", async () => {
    const t = createConvexTestWithBetterAuth();

    await expect(
      t.mutation(internal.contents.mutations.search.bulkSyncQuranSearch, {
        documents: [
          {
            contentHash: "hash-fatihah",
            description: "Pembukaan",
            locale: "id",
            route: "quran/1",
            text: "Al-Fatihah pembukaan rahmat petunjuk",
            title: "1. Al-Fatihah",
          },
        ],
      })
    ).rejects.toThrow("requires a persisted route graph projection");
  });
});
