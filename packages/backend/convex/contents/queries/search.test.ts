import { api, internal } from "@repo/backend/convex/_generated/api";
import { CONTENT_SEARCH_MAX_OFFSET } from "@repo/backend/convex/contents/helpers/search/constants";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { describe, expect, it } from "vitest";

describe("contents/queries/search:search", () => {
  it("searches title and body text with locale and section filters", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentSearch", {
        contentHash: "hash-rational",
        content_id:
          "id/subject/high-school/11/mathematics/function-modeling/rational-function",
        description: "Pelajari fungsi rasional.",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/subject/high-school/11/mathematics/function-modeling/rational-function.md",
        route:
          "subject/high-school/11/mathematics/function-modeling/rational-function",
        section: "subject",
        syncedAt: 1,
        text: "kelas 11 matematika pemodelan fungsi penyebut domain asimtot",
        title: "Fungsi Rasional",
        url: "https://nakafa.com/id/subject/high-school/11/mathematics/function-modeling/rational-function",
      });
      await ctx.db.insert("contentSearch", {
        contentHash: "hash-domain",
        content_id:
          "id/subject/high-school/11/mathematics/function-modeling/domain-codomain-range",
        description: "Pelajari domain dan range.",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/subject/high-school/11/mathematics/function-modeling/domain-codomain-range.md",
        route:
          "subject/high-school/11/mathematics/function-modeling/domain-codomain-range",
        section: "subject",
        syncedAt: 1,
        text: "fungsi rasional muncul dalam contoh batas input dan output",
        title: "Domain, Kodomain, dan Range",
        url: "https://nakafa.com/id/subject/high-school/11/mathematics/function-modeling/domain-codomain-range",
      });
      await ctx.db.insert("contentSearch", {
        contentHash: "hash-en",
        content_id:
          "en/subject/high-school/11/mathematics/function-modeling/rational-function",
        description: "Learn rational functions.",
        locale: "en",
        markdown_url:
          "https://nakafa.com/en/subject/high-school/11/mathematics/function-modeling/rational-function.md",
        route:
          "subject/high-school/11/mathematics/function-modeling/rational-function",
        section: "subject",
        syncedAt: 1,
        text: "grade 11 mathematics rational function",
        title: "Rational Function",
        url: "https://nakafa.com/en/subject/high-school/11/mathematics/function-modeling/rational-function",
      });
    });

    const titleResult = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["fungsi rasional kelas 11"],
      section: "subject",
    });
    const bodyResult = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["batas input output"],
      section: "subject",
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
        content_id:
          "id/subject/high-school/11/mathematics/function-modeling/domain-codomain-range",
        excerpt: expect.stringContaining("batas input"),
      }),
    ]);
    expect(bodyResult.items[0].excerpt).not.toContain("<mark>");
  });

  it("prioritizes exercise context over generic exercise titles", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentSearch", {
        contentHash: "hash-english-11",
        content_id:
          "id/exercises/high-school/snbt/english-language/try-out/2026/set-2/11",
        description: "",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/exercises/high-school/snbt/english-language/try-out/2026/set-2/11.md",
        route:
          "exercises/high-school/snbt/english-language/try-out/2026/set-2/11",
        section: "exercises",
        syncedAt: 1,
        text: "Soal 11 english-language try-out set-2 reading passage",
        title: "Soal 11",
        url: "https://nakafa.com/id/exercises/high-school/snbt/english-language/try-out/2026/set-2/11",
      });
      await ctx.db.insert("contentSearch", {
        contentHash: "hash-quantitative-11",
        content_id:
          "id/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/11",
        description:
          "SMA SNBT Pengetahuan Kuantitatif try out 2026 set 2 Nomor 11",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/11.md",
        route:
          "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/11",
        section: "exercises",
        syncedAt: 1,
        text: "Soal 11 Nomor 11 quantitative-knowledge Pengetahuan Kuantitatif try-out try out 2026 set-2 set 2 fungsi tangga",
        title: "Soal 11",
        url: "https://nakafa.com/id/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/11",
      });
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["SNBT Pengetahuan Kuantitatif try out 2026 set 2 nomor 11"],
      section: "exercises",
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        content_id:
          "id/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/11",
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
            slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2",
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
      section: "exercises",
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        content_id:
          "id/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2",
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
            slug: "exercises/middle-school/grade-9/mathematics/semester-1/set-1",
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
      section: "exercises",
    });

    expect(result.items).toEqual([]);
  });

  it("prefers exercise set rows over generic question body hits for broad searches", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentSearch", {
        contentHash: "hash-language-question",
        content_id:
          "id/exercises/high-school/snbt/indonesian-language/try-out/2026/set-1/1",
        description: "",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/exercises/high-school/snbt/indonesian-language/try-out/2026/set-1/1.md",
        route:
          "exercises/high-school/snbt/indonesian-language/try-out/2026/set-1/1",
        section: "exercises",
        syncedAt: 1,
        text: "Soal bacaan yang menyebut pola bilangan sebagai contoh.",
        title: "Soal 1",
        url: "https://nakafa.com/id/exercises/high-school/snbt/indonesian-language/try-out/2026/set-1/1",
      });
      await ctx.db.insert("contentSearch", {
        contentHash: "hash-math-set",
        content_id:
          "id/exercises/high-school/snbt/mathematical-reasoning/try-out/2026/set-1",
        description: "SNBT Penalaran Matematika Try Out 2026 Set 1 20 soal",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/exercises/high-school/snbt/mathematical-reasoning/try-out/2026/set-1.md",
        route:
          "exercises/high-school/snbt/mathematical-reasoning/try-out/2026/set-1",
        section: "exercises",
        syncedAt: 1,
        text: "Latihan pola bilangan untuk penalaran matematika.",
        title: "SNBT Penalaran Matematika Try Out 2026 Set 1",
        url: "https://nakafa.com/id/exercises/high-school/snbt/mathematical-reasoning/try-out/2026/set-1",
      });
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["pola bilangan"],
      section: "exercises",
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        content_id:
          "id/exercises/high-school/snbt/mathematical-reasoning/try-out/2026/set-1",
      })
    );
  });

  it("does not let grade numbers dominate exercise topic searches", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentSearch", {
        contentHash: "hash-question-11",
        content_id:
          "id/exercises/high-school/snbt/general-reasoning/try-out/2026/set-3/11",
        description: "SMA SNBT Penalaran Umum Try Out 2026 Set 3 Nomor 11",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/exercises/high-school/snbt/general-reasoning/try-out/2026/set-3/11.md",
        route:
          "exercises/high-school/snbt/general-reasoning/try-out/2026/set-3/11",
        section: "exercises",
        syncedAt: 1,
        text: "Soal umum nomor 11.",
        title: "SNBT Penalaran Umum Try Out 2026 Set 3 Soal 11",
        url: "https://nakafa.com/id/exercises/high-school/snbt/general-reasoning/try-out/2026/set-3/11",
      });
      await ctx.db.insert("contentSearch", {
        contentHash: "hash-rational-set",
        content_id:
          "id/exercises/high-school/tka/mathematics/try-out/2026/set-1",
        description: "SMA TKA Matematika Try Out 2026 Set 1 20 soal",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/exercises/high-school/tka/mathematics/try-out/2026/set-1.md",
        route: "exercises/high-school/tka/mathematics/try-out/2026/set-1",
        section: "exercises",
        syncedAt: 1,
        text: "Latihan fungsi rasional kelas 11.",
        title: "TKA Matematika Try Out 2026 Set 1",
        url: "https://nakafa.com/id/exercises/high-school/tka/mathematics/try-out/2026/set-1",
      });
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["fungsi rasional kelas 11"],
      section: "exercises",
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        content_id:
          "id/exercises/high-school/tka/mathematics/try-out/2026/set-1",
      })
    );
  });

  it("drops weak exercise hits when only one semantic query token matches", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentSearch", {
        contentHash: "hash-class-question",
        content_id:
          "id/exercises/high-school/snbt/general-reasoning/try-out/2026/set-3/11",
        description: "SMA SNBT Penalaran Umum Try Out 2026 Set 3 Nomor 11",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/exercises/high-school/snbt/general-reasoning/try-out/2026/set-3/11.md",
        route:
          "exercises/high-school/snbt/general-reasoning/try-out/2026/set-3/11",
        section: "exercises",
        syncedAt: 1,
        text: "Semua siswa kelas 9 mengikuti ujian sekolah.",
        title: "SNBT Penalaran Umum Try Out 2026 Set 3 Soal 11",
        url: "https://nakafa.com/id/exercises/high-school/snbt/general-reasoning/try-out/2026/set-3/11",
      });
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["fungsi rasional kelas 11"],
      section: "exercises",
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
            slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-3",
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
              "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-3"
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
      section: "exercises",
    });

    expect(result.items).toEqual([]);
  });

  it("searches multiple unique query variants in one bounded request", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentSearch", {
        contentHash: "hash-mass",
        content_id:
          "id/subject/high-school/10/chemistry/basic-chemistry-laws/mass-conservation-law",
        description: "Pelajari hukum kekekalan massa.",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/subject/high-school/10/chemistry/basic-chemistry-laws/mass-conservation-law.md",
        route:
          "subject/high-school/10/chemistry/basic-chemistry-laws/mass-conservation-law",
        section: "subject",
        syncedAt: 1,
        text: "kimia kelas 10 reaksi tertutup massa zat tetap",
        title: "Hukum Kekekalan Massa",
        url: "https://nakafa.com/id/subject/high-school/10/chemistry/basic-chemistry-laws/mass-conservation-law",
      });
      await ctx.db.insert("contentSearch", {
        contentHash: "hash-stoichiometry",
        content_id:
          "id/subject/high-school/10/chemistry/stoichiometry/introduction",
        description: "Pelajari stoikiometri.",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/subject/high-school/10/chemistry/stoichiometry/introduction.md",
        route: "subject/high-school/10/chemistry/stoichiometry/introduction",
        section: "subject",
        syncedAt: 1,
        text: "perhitungan kimia mol massa reaksi",
        title: "Stoikiometri",
        url: "https://nakafa.com/id/subject/high-school/10/chemistry/stoichiometry/introduction",
      });
      await ctx.db.insert("contentSearch", {
        contentHash: "hash-mass-application",
        content_id:
          "id/subject/high-school/10/chemistry/basic-chemistry-laws/mass-application",
        description: "Latihan tambahan hukum kekekalan massa.",
        locale: "id",
        markdown_url:
          "https://nakafa.com/id/subject/high-school/10/chemistry/basic-chemistry-laws/mass-application.md",
        route:
          "subject/high-school/10/chemistry/basic-chemistry-laws/mass-application",
        section: "subject",
        syncedAt: 1,
        text: "hukum kekekalan massa contoh lanjutan",
        title: "Aplikasi Massa",
        url: "https://nakafa.com/id/subject/high-school/10/chemistry/basic-chemistry-laws/mass-application",
      });
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 2,
      locale: "id",
      offset: 0,
      queries: ["hukum kekekalan massa", "stoikiometri"],
      section: "subject",
    });

    expect(result.items.map((item) => item.title)).toEqual([
      "Hukum Kekekalan Massa",
      "Stoikiometri",
    ]);
  });

  it("browses a stable bounded list when no query is provided", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentSearch", {
        contentHash: "hash-b",
        content_id: "id/articles/science/b",
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
      await ctx.db.insert("contentSearch", {
        contentHash: "hash-a",
        content_id: "id/articles/science/a",
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

        await ctx.db.insert("contentSearch", {
          contentHash: `hash-search-cap-${index}`,
          content_id: `id/articles/search-cap/${index}`,
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

    await t.mutation(internal.contents.mutations.search.bulkSyncQuranSearch, {
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
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["petunjuk"],
      section: "quran",
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        content_id: "id/quran/1",
        section: "quran",
        title: "1. Al-Fatihah",
      }),
    ]);
  });
});
