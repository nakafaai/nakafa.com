import { api, internal } from "@repo/backend/convex/_generated/api";
import { CONTENT_SEARCH_MAX_OFFSET } from "@repo/backend/convex/contents/helpers/search/constants";
import { readContentSearchDocuments } from "@repo/backend/convex/contents/helpers/search/read";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  getPublicSearchPath,
  insertContentSearch,
  searchContentId,
} from "@repo/backend/test/search";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { describe, expect, it } from "vitest";

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
});
