import { api, internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_SEARCH_MAX_OFFSET } from "@repo/backend/convex/contents/helpers/search/constants";
import { readContentSearchDocuments } from "@repo/backend/convex/contents/helpers/search/read";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import type { Locale } from "@repo/contents/_types/content";
import type { SourceRegistryRoot } from "@repo/contents/_types/graph/schema";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { describe, expect, it } from "vitest";

interface ContentSearchFixture {
  contentHash: string;
  description: string;
  locale: Locale;
  markdown_url: string;
  route: string;
  section: SourceRegistryRoot;
  syncedAt: number;
  text: string;
  title: string;
  url: string;
}

/** Inserts a content search fixture with graph identity as product identity. */
async function insertContentSearch(
  ctx: MutationCtx,
  fixture: ContentSearchFixture
) {
  const identity = createLearningGraphIdentityFromRoute({
    locale: fixture.locale,
    route: fixture.route,
  });

  if (!identity) {
    throw new Error(`Expected graph identity for ${fixture.route}.`);
  }

  await ctx.db.insert("contentSearch", {
    ...fixture,
    ...identity,
    content_id: identity.assetId,
  });
}

/** Returns the graph asset ID for a search route fixture. */
function searchContentId(locale: Locale, route: string) {
  const identity = createLearningGraphIdentityFromRoute({ locale, route });

  if (!identity) {
    throw new Error(`Expected graph identity for ${route}.`);
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
        markdown_url:
          "https://nakafa.com/id/material/lesson/mathematics/function-modeling/rational-function.md",
        route:
          "material/lesson/mathematics/function-modeling/rational-function",
        section: "material",
        syncedAt: 1,
        text: "kelas 11 matematika pemodelan fungsi penyebut domain asimtot",
        title: "Fungsi Rasional",
        url: "https://nakafa.com/id/material/lesson/mathematics/function-modeling/rational-function",
      });
      await insertContentSearch(ctx, {
        contentHash: "hash-domain",
        description: "Pelajari domain dan range.",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/material/lesson/mathematics/function-modeling/domain-codomain-range.md",
        route:
          "material/lesson/mathematics/function-modeling/domain-codomain-range",
        section: "material",
        syncedAt: 1,
        text: "fungsi rasional muncul dalam contoh batas input dan output",
        title: "Domain, Kodomain, dan Range",
        url: "https://nakafa.com/id/material/lesson/mathematics/function-modeling/domain-codomain-range",
      });
      await insertContentSearch(ctx, {
        contentHash: "hash-en",
        description: "Learn rational functions.",
        locale: "en",
        markdown_url:
          "https://nakafa.com/en/material/lesson/mathematics/function-modeling/rational-function.md",
        route:
          "material/lesson/mathematics/function-modeling/rational-function",
        section: "material",
        syncedAt: 1,
        text: "grade 11 mathematics rational function",
        title: "Rational Function",
        url: "https://nakafa.com/en/material/lesson/mathematics/function-modeling/rational-function",
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

    await t.mutation(async (ctx) => {
      await insertContentSearch(ctx, {
        contentHash: "hash-logarithm",
        description: "Memahami bentuk dasar logaritma.",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/material/lesson/mathematics/exponential-logarithm/logarithm-definition.md",
        route:
          "material/lesson/mathematics/exponential-logarithm/logarithm-definition",
        section: "material",
        syncedAt: 1,
        text: "Definisi Logaritma menjelaskan pangkat yang dibutuhkan.",
        title: "Definisi Logaritma",
        url: "https://nakafa.com/id/material/lesson/mathematics/exponential-logarithm/logarithm-definition",
      });
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 5,
      locale: "id",
      offset: 0,
      queries: [
        "material/lesson/mathematics/exponential-logarithm/logarithm-definition",
      ],
      section: "material",
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        content_id: searchContentId(
          "id",
          "material/lesson/mathematics/exponential-logarithm/logarithm-definition"
        ),
        excerpt: expect.stringContaining("Memahami bentuk dasar logaritma."),
      }),
    ]);
    expect(result.items[0].excerpt).not.toContain("material/lesson");
    expect(result.items[0].excerpt).not.toContain("exponential-logarithm");
  });

  it("resolves exact routes through persisted route catalog content IDs", async () => {
    const t = createConvexTestWithBetterAuth();
    const route =
      "material/lesson/mathematics/exponential-logarithm/logarithm-definition";
    const identity = createLearningGraphIdentityFromRoute({
      locale: "id",
      route,
    });

    if (!identity) {
      throw new Error(`Expected graph identity for ${route}.`);
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

  it("prioritizes exercise context over generic exercise titles", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await insertContentSearch(ctx, {
        contentHash: "hash-english-11",
        description: "",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/material/practice/assessment/snbt/english-language/try-out-2026/set-2/question-11.md",
        route:
          "material/practice/assessment/snbt/english-language/try-out-2026/set-2/question-11",
        section: "material",
        syncedAt: 1,
        text: "Soal 11 english-language try-out set-2 reading passage",
        title: "Soal 11",
        url: "https://nakafa.com/id/material/practice/assessment/snbt/english-language/try-out-2026/set-2/question-11",
      });
      await insertContentSearch(ctx, {
        contentHash: "hash-quantitative-11",
        description:
          "SMA SNBT Pengetahuan Kuantitatif try out 2026 set 2 Nomor 11",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-2/question-11.md",
        route:
          "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-2/question-11",
        section: "material",
        syncedAt: 1,
        text: "Soal 11 Nomor 11 quantitative-knowledge Pengetahuan Kuantitatif try-out try out 2026 set-2 set 2 fungsi tangga",
        title: "Soal 11",
        url: "https://nakafa.com/id/material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-2/question-11",
      });
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["SNBT Pengetahuan Kuantitatif try out 2026 set 2 nomor 11"],
      section: "material",
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        content_id: searchContentId(
          "id",
          "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-2/question-11"
        ),
      })
    );
  });

  it("indexes exercise sets as set-level refs for broad retrieval", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(
      internal.contentSync.mutations.exercises.bulkSyncExerciseSets,
      {
        sets: [
          {
            category: "high-school",
            contentHash: "hash-set",
            description: "Kumpulan latihan fungsi rasional.",
            exerciseType: "try-out",
            exerciseTypeTitle: "Try Out",
            groupContentHash: "hash-group",
            locale: "id",
            material: "quantitative-knowledge",
            questionCount: 20,
            searchDescription:
              "SMA SNBT Pengetahuan Kuantitatif Try Out 2026 Set 2 20 soal",
            searchText:
              "SNBT Pengetahuan Kuantitatif try-out try out 2026 set-2 set 2 fungsi rasional 20 soal",
            searchTitle: "SNBT Pengetahuan Kuantitatif Try Out 2026 Set 2",
            setName: "set-2",
            slug: "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-2",
            title: "Set 2",
            type: "snbt",
          },
        ],
      }
    );

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["latihan fungsi rasional"],
      section: "material",
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        content_id: searchContentId(
          "id",
          "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-2"
        ),
        title: "SNBT Pengetahuan Kuantitatif Try Out 2026 Set 2",
      })
    );
  });

  it("does not index empty exercise sets for retrieval", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(
      internal.contentSync.mutations.exercises.bulkSyncExerciseSets,
      {
        sets: [
          {
            category: "middle-school",
            contentHash: "hash-empty-set",
            description: "Belum ada soal.",
            exerciseType: "semester-1",
            exerciseTypeTitle: "Semester 1",
            groupContentHash: "hash-empty-group",
            locale: "id",
            material: "mathematics",
            questionCount: 0,
            searchDescription: "SMP Kelas 9 Matematika Semester 1 Set 1 0 soal",
            searchText: "kelas 9 matematika semester 1 0 soal",
            searchTitle: "Kelas 9 Matematika Semester 1 Set 1",
            setName: "set-1",
            slug: "material/practice/assessment/grade-9/mathematics/semester-1/set-1",
            title: "Set 1",
            type: "grade-9",
          },
        ],
      }
    );

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["kelas 9 matematika"],
      section: "material",
    });

    expect(result.items).toEqual([]);
  });

  it("prefers exercise set rows over generic question body hits for broad searches", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await insertContentSearch(ctx, {
        contentHash: "hash-language-question",
        description: "",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/material/practice/assessment/snbt/indonesian-language/try-out-2026/set-1/question-1.md",
        route:
          "material/practice/assessment/snbt/indonesian-language/try-out-2026/set-1/question-1",
        section: "material",
        syncedAt: 1,
        text: "Soal bacaan yang menyebut pola bilangan sebagai contoh.",
        title: "Soal 1",
        url: "https://nakafa.com/id/material/practice/assessment/snbt/indonesian-language/try-out-2026/set-1/question-1",
      });
      await insertContentSearch(ctx, {
        contentHash: "hash-math-set",
        description: "SNBT Penalaran Matematika Try Out 2026 Set 1 20 soal",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/material/practice/assessment/snbt/mathematical-reasoning/try-out-2026/set-1.md",
        route:
          "material/practice/assessment/snbt/mathematical-reasoning/try-out-2026/set-1",
        section: "material",
        syncedAt: 1,
        text: "Latihan pola bilangan untuk penalaran matematika.",
        title: "SNBT Penalaran Matematika Try Out 2026 Set 1",
        url: "https://nakafa.com/id/material/practice/assessment/snbt/mathematical-reasoning/try-out-2026/set-1",
      });
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["pola bilangan"],
      section: "material",
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        content_id: searchContentId(
          "id",
          "material/practice/assessment/snbt/mathematical-reasoning/try-out-2026/set-1"
        ),
      })
    );
  });

  it("does not let grade numbers dominate exercise topic searches", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await insertContentSearch(ctx, {
        contentHash: "hash-question-11",
        description: "SMA SNBT Penalaran Umum Try Out 2026 Set 3 Nomor 11",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/material/practice/assessment/snbt/general-reasoning/try-out-2026/set-3/question-11.md",
        route:
          "material/practice/assessment/snbt/general-reasoning/try-out-2026/set-3/question-11",
        section: "material",
        syncedAt: 1,
        text: "Soal umum nomor 11.",
        title: "SNBT Penalaran Umum Try Out 2026 Set 3 Soal 11",
        url: "https://nakafa.com/id/material/practice/assessment/snbt/general-reasoning/try-out-2026/set-3/question-11",
      });
      await insertContentSearch(ctx, {
        contentHash: "hash-rational-set",
        description: "SMA TKA Matematika Try Out 2026 Set 1 20 soal",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/material/practice/assessment/tka/mathematics/try-out-2026/set-1.md",
        route:
          "material/practice/assessment/tka/mathematics/try-out-2026/set-1",
        section: "material",
        syncedAt: 1,
        text: "Latihan fungsi rasional kelas 11.",
        title: "TKA Matematika Try Out 2026 Set 1",
        url: "https://nakafa.com/id/material/practice/assessment/tka/mathematics/try-out-2026/set-1",
      });
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["fungsi rasional kelas 11"],
      section: "material",
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        content_id: searchContentId(
          "id",
          "material/practice/assessment/tka/mathematics/try-out-2026/set-1"
        ),
      })
    );
  });

  it("drops weak exercise hits when only one semantic query token matches", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await insertContentSearch(ctx, {
        contentHash: "hash-class-question",
        description: "SMA SNBT Penalaran Umum Try Out 2026 Set 3 Nomor 11",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/material/practice/assessment/snbt/general-reasoning/try-out-2026/set-3/question-11.md",
        route:
          "material/practice/assessment/snbt/general-reasoning/try-out-2026/set-3/question-11",
        section: "material",
        syncedAt: 1,
        text: "Semua siswa kelas 9 mengikuti ujian sekolah.",
        title: "SNBT Penalaran Umum Try Out 2026 Set 3 Soal 11",
        url: "https://nakafa.com/id/material/practice/assessment/snbt/general-reasoning/try-out-2026/set-3/question-11",
      });
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["fungsi rasional kelas 11"],
      section: "material",
    });

    expect(result.items).toEqual([]);
  });

  it("removes exercise set search rows when stale sets are deleted", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(
      internal.contentSync.mutations.exercises.bulkSyncExerciseSets,
      {
        sets: [
          {
            category: "high-school",
            contentHash: "hash-stale-set",
            description: "Kumpulan latihan fungsi kuadrat.",
            exerciseType: "try-out",
            exerciseTypeTitle: "Try Out",
            groupContentHash: "hash-stale-group",
            locale: "id",
            material: "quantitative-knowledge",
            questionCount: 0,
            searchDescription:
              "SMA SNBT Pengetahuan Kuantitatif Try Out 2026 Set 3 0 soal",
            searchText:
              "SNBT Pengetahuan Kuantitatif try-out try out 2026 set-3 set 3 fungsi kuadrat 0 soal",
            searchTitle: "SNBT Pengetahuan Kuantitatif Try Out 2026 Set 3",
            setName: "set-3",
            slug: "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-3",
            title: "Set 3",
            type: "snbt",
          },
        ],
      }
    );

    const setId = await t.query(async (ctx) => {
      const exerciseSet = await ctx.db
        .query("exerciseSets")
        .withIndex("by_locale_and_slug", (q) =>
          q
            .eq("locale", "id")
            .eq(
              "slug",
              "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-3"
            )
        )
        .unique();

      if (!exerciseSet) {
        throw new Error("Expected synced exercise set.");
      }

      return exerciseSet._id;
    });

    await t.mutation(
      internal.contentSync.mutations.exercises.deleteStaleExerciseSets,
      {
        setIds: [setId],
      }
    );

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["fungsi kuadrat"],
      section: "material",
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
        markdown_url:
          "https://nakafa.com/id/material/lesson/chemistry/basic-chemistry-laws/mass-conservation-law.md",
        route:
          "material/lesson/chemistry/basic-chemistry-laws/mass-conservation-law",
        section: "material",
        syncedAt: 1,
        text: "kimia kelas 10 reaksi tertutup massa zat tetap",
        title: "Hukum Kekekalan Massa",
        url: "https://nakafa.com/id/material/lesson/chemistry/basic-chemistry-laws/mass-conservation-law",
      });
      await insertContentSearch(ctx, {
        contentHash: "hash-stoichiometry",
        description: "Pelajari stoikiometri.",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/material/lesson/chemistry/stoichiometry/introduction.md",
        route: "material/lesson/chemistry/stoichiometry/introduction",
        section: "material",
        syncedAt: 1,
        text: "perhitungan kimia mol massa reaksi",
        title: "Stoikiometri",
        url: "https://nakafa.com/id/material/lesson/chemistry/stoichiometry/introduction",
      });
      await insertContentSearch(ctx, {
        contentHash: "hash-mass-application",
        description: "Latihan tambahan hukum kekekalan massa.",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/material/lesson/chemistry/basic-chemistry-laws/mass-application.md",
        route:
          "material/lesson/chemistry/basic-chemistry-laws/mass-application",
        section: "material",
        syncedAt: 1,
        text: "hukum kekekalan massa contoh lanjutan",
        title: "Aplikasi Massa",
        url: "https://nakafa.com/id/material/lesson/chemistry/basic-chemistry-laws/mass-application",
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
        markdown_url: "https://nakafa.com/id/articles/science/b.md",
        route: "articles/science/b",
        section: "articles",
        syncedAt: 1,
        text: "Beta",
        title: "Beta",
        url: "https://nakafa.com/id/articles/science/b",
      });
      await insertContentSearch(ctx, {
        contentHash: "hash-a",
        description: "",
        locale: "id",
        markdown_url: "https://nakafa.com/id/articles/science/a.md",
        route: "articles/science/a",
        section: "articles",
        syncedAt: 1,
        text: "Alpha",
        title: "Alpha",
        url: "https://nakafa.com/id/articles/science/a",
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
          markdown_url: `https://nakafa.com/id/articles/search-cap/${index}.md`,
          route: `articles/search-cap/${index}`,
          section: "articles",
          syncedAt: 1,
          text: "searchcap pagination",
          title,
          url: `https://nakafa.com/id/articles/search-cap/${index}`,
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
        throw new Error("Expected synced article.");
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
      throw new Error(`Expected graph identity for ${route}.`);
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
