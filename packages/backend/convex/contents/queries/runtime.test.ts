import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { ContentType } from "@repo/backend/convex/lib/validators/contents";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import type { Locale } from "@repo/contents/_types/content";
import {
  createLearningGraphIdentityFromRoute,
  getLearningObjectKindForRoute,
} from "@repo/contents/_types/learning-graph";
import { describe, expect, it } from "vitest";

const NOW = Date.parse("2026-01-02T00:00:00.000Z");

/** Inserts the author fixture shared by runtime query tests. */
async function insertAuthor(ctx: MutationCtx) {
  return await ctx.db.insert("authors", {
    name: "Nakafa Author",
    username: "nakafa-author",
  });
}

/** Links an author fixture to one synced content row. */
async function linkAuthor(
  ctx: MutationCtx,
  args: {
    authorId: Id<"authors">;
    contentId:
      | Id<"articleContents">
      | Id<"curriculumLessons">
      | Id<"exerciseQuestions">;
    contentType: ContentType;
  }
) {
  await ctx.db.insert("contentAuthors", {
    authorId: args.authorId,
    contentId: args.contentId,
    contentType: args.contentType,
    order: 0,
  });
}

/** Builds graph identity fields for one route fixture. */
function contentRouteGraph(locale: Locale, route: string) {
  const identity = createLearningGraphIdentityFromRoute({ locale, route });

  if (!identity) {
    throw new Error(`Expected graph identity for ${route}.`);
  }

  return {
    ...identity,
    content_id: identity.assetId,
    sourcePath: route,
  };
}

type RuntimeRouteKind = NonNullable<
  ReturnType<typeof getLearningObjectKindForRoute>
>;

type ContentRouteGraphFixture = ReturnType<typeof contentRouteGraph>;

/** Inserts one published exercise set fixture in the shared SNBT group. */
async function insertExerciseSetFixture(
  ctx: MutationCtx,
  args: {
    setName: string;
    slug: string;
    title: string;
    year: string;
  }
) {
  return await ctx.db.insert("exerciseSets", {
    category: "high-school",
    description: "Try-out group",
    exerciseType: "try-out",
    locale: "id",
    material: "quantitative-knowledge",
    questionCount: 1,
    setName: args.setName,
    slug: args.slug,
    syncedAt: NOW,
    title: args.title,
    type: "snbt",
    year: args.year,
  });
}

/** Inserts one exercise question fixture with both required choice locales. */
async function insertExerciseQuestionFixture(
  ctx: MutationCtx,
  args: {
    setId: Id<"exerciseSets">;
    setName: string;
    slug: string;
  }
) {
  const questionId = await ctx.db.insert("exerciseQuestions", {
    answerBody: "Answer body",
    category: "high-school",
    contentHash: "question-hash",
    date: NOW,
    exerciseType: "try-out",
    locale: "id",
    material: "quantitative-knowledge",
    number: 1,
    questionBody: "Question body",
    setId: args.setId,
    setName: args.setName,
    slug: args.slug,
    syncedAt: NOW,
    title: "Soal 1",
    type: "snbt",
  });

  await ctx.db.insert("exerciseChoices", {
    isCorrect: true,
    label: "A. Benar",
    locale: "id",
    optionKey: "A",
    order: 0,
    questionId,
  });
  await ctx.db.insert("exerciseChoices", {
    isCorrect: true,
    label: "A. Correct",
    locale: "en",
    optionKey: "A",
    order: 0,
    questionId,
  });

  return questionId;
}

/** Inserts one exercise content-route projection fixture. */
async function insertExerciseRouteFixture(
  ctx: MutationCtx,
  args: {
    contentHash: string;
    graph?: ContentRouteGraphFixture;
    kind: RuntimeRouteKind;
    route: string;
    title: string;
  }
) {
  await ctx.db.insert("contentRoutes", {
    ...(args.graph ?? contentRouteGraph("id", args.route)),
    authors: [],
    contentHash: args.contentHash,
    kind: args.kind,
    locale: "id",
    markdown: true,
    route: args.route,
    section: "material",
    syncedAt: NOW,
    title: args.title,
  });
}

/** Deletes one content-route projection fixture by its indexed route key. */
async function deleteContentRouteFixture(
  ctx: MutationCtx,
  args: {
    locale: Locale;
    route: string;
  }
) {
  const route = await ctx.db
    .query("contentRoutes")
    .withIndex("by_locale_and_route", (q) =>
      q.eq("locale", args.locale).eq("route", args.route)
    )
    .unique();

  if (!route) {
    throw new Error(`Expected content route fixture for ${args.route}.`);
  }

  await ctx.db.delete(route._id);
}

describe("contents/queries/runtime", () => {
  it("returns Quran references with synced route catalog graph identity", async () => {
    const t = createConvexTestWithBetterAuth();
    const route = "quran/1";
    const graph = contentRouteGraph("id", route);
    const catalogAssetId = `${graph.assetId}:catalog`;

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentRoutes", {
        ...graph,
        assetId: catalogAssetId,
        authors: [],
        contentHash: "quran-route-hash",
        content_id: catalogAssetId,
        kind: "quran-surah",
        locale: "id",
        markdown: true,
        route,
        section: "quran",
        syncedAt: NOW,
        title: "Al-Fatihah",
      });
      await ctx.db.insert("quranSurahs", {
        contentHash: "quran-surah-hash",
        name: {
          long: "Al-Fatihah",
          short: "Al-Fatihah",
          translation: {
            en: "The Opening",
            id: "Pembukaan",
          },
          transliteration: {
            en: "Al-Fatihah",
            id: "Al-Fatihah",
          },
        },
        number: 1,
        numberOfVerses: 1,
        revelation: {
          arab: "Makkiyah",
          en: "Meccan",
          id: "Makkiyah",
        },
        sequence: 5,
        syncedAt: NOW,
      });
      await ctx.db.insert("quranVerses", {
        audio: { primary: "primary.mp3", secondary: [] },
        contentHash: "quran-verse-hash",
        hizbQuarter: 1,
        juz: 1,
        manzil: 1,
        page: 1,
        quranNumber: 1,
        ruku: 1,
        sajdaObligatory: false,
        sajdaRecommended: false,
        surahNumber: 1,
        syncedAt: NOW,
        tafsir: {
          id: {
            long: "Tafsir panjang",
            short: "Tafsir pendek",
          },
        },
        text: {
          arab: "بسم الله",
          transliteration: {
            en: "Bismillah",
          },
        },
        translation: {
          en: "In the name of Allah",
          id: "Dengan nama Allah",
        },
        verseNumber: 1,
      });
    });

    const result = await t.query(
      api.contents.queries.runtime.getQuranReference,
      {
        fromVerse: 1,
        includeTafsir: false,
        locale: "id",
        surah: 1,
      }
    );

    expect(result).toEqual(
      expect.objectContaining({
        assetId: catalogAssetId,
        content_id: catalogAssetId,
        route,
        section: "quran",
      })
    );
  });

  it("loads article and curriculum pages from synced runtime rows", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      const authorId = await insertAuthor(ctx);
      const articleId = await ctx.db.insert("articleContents", {
        articleSlug: "runtime-article",
        body: "## Article body",
        category: "politics",
        contentHash: "article-hash",
        date: NOW,
        description: "Article description",
        locale: "id",
        slug: "articles/politics/runtime-article",
        syncedAt: NOW,
        title: "Runtime Article",
      });
      await linkAuthor(ctx, {
        authorId,
        contentId: articleId,
        contentType: "article",
      });
      await ctx.db.insert("articleReferences", {
        articleId,
        authors: "Reference Author",
        order: 0,
        title: "Reference",
        year: 2026,
      });

      const topicId = await ctx.db.insert("curriculumTopics", {
        locale: "id",
        material: "mathematics",
        order: 0,
        sectionCount: 1,
        slug: "material/lesson/mathematics/runtime-topic",
        syncedAt: NOW,
        title: "Runtime Topic",
        topic: "runtime-topic",
      });
      const sectionId = await ctx.db.insert("curriculumLessons", {
        body: "## Subject body",
        contentHash: "subject-hash",
        date: NOW,
        description: "Subject description",
        locale: "id",
        material: "mathematics",
        order: 0,
        section: "runtime-section",
        slug: "material/lesson/mathematics/runtime-topic/runtime-section",
        subject: "Runtime Topic",
        syncedAt: NOW,
        title: "Runtime Subject",
        topic: "runtime-topic",
        topicId,
      });
      await linkAuthor(ctx, {
        authorId,
        contentId: sectionId,
        contentType: "material",
      });
    });

    const article = await t.query(api.contents.queries.runtime.getArticlePage, {
      locale: "id",
      slug: "articles/politics/runtime-article",
    });
    const subject = await t.query(
      api.contents.queries.runtime.getCurriculumPage,
      {
        locale: "id",
        slug: "material/lesson/mathematics/runtime-topic/runtime-section",
      }
    );

    expect(article).toEqual(
      expect.objectContaining({
        body: "## Article body",
        metadata: expect.objectContaining({
          authors: [{ name: "Nakafa Author" }],
          date: "2026-01-02",
          title: "Runtime Article",
        }),
        references: [expect.objectContaining({ title: "Reference" })],
      })
    );
    expect(subject).toEqual(
      expect.objectContaining({
        body: "## Subject body",
        metadata: expect.objectContaining({
          subject: "Runtime Topic",
          title: "Runtime Subject",
        }),
      })
    );
  });

  it("loads exercise runtime pages and rejects missing graph projection", async () => {
    const t = createConvexTestWithBetterAuth();
    const slug =
      "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1";
    const secondSlug =
      "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-2";
    const tenthSlug =
      "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-10";
    const setGraph = detachedContentRouteGraph(slug, "exercise-set");
    const questionGraph = detachedContentRouteGraph(
      `${slug}/1`,
      "exercise-question"
    );

    await t.mutation(async (ctx) => {
      const authorId = await insertAuthor(ctx);
      const setId = await insertExerciseSetFixture(ctx, {
        setName: "set-1",
        slug,
        title: "Set 1",
        year: "2026",
      });
      await insertExerciseSetFixture(ctx, {
        setName: "set-10",
        slug: tenthSlug,
        title: "Set 10",
        year: "2026",
      });
      await insertExerciseSetFixture(ctx, {
        setName: "set-2",
        slug: secondSlug,
        title: "Set 2",
        year: "2026",
      });
      const questionId = await insertExerciseQuestionFixture(ctx, {
        setId,
        setName: "set-1",
        slug: `${slug}/1`,
      });
      await linkAuthor(ctx, {
        authorId,
        contentId: questionId,
        contentType: "material",
      });
      await insertExerciseRouteFixture(ctx, {
        contentHash: "set-route-hash",
        graph: setGraph,
        kind: "exercise-set",
        route: slug,
        title: "Set 1",
      });
      await insertExerciseRouteFixture(ctx, {
        contentHash: "question-route-hash",
        graph: questionGraph,
        kind: "exercise-question",
        route: `${slug}/1`,
        title: "Soal 1",
      });
      await insertExerciseRouteFixture(ctx, {
        contentHash: "set-2-route-hash",
        kind: "exercise-set",
        route: secondSlug,
        title: "Set 2",
      });
      await insertExerciseRouteFixture(ctx, {
        contentHash: "set-10-route-hash",
        kind: "exercise-set",
        route: tenthSlug,
        title: "Set 10",
      });
    });

    const setPage = await t.query(
      api.contents.queries.runtime.getExerciseSetPage,
      { locale: "id", slug }
    );
    const questionPage = await t.query(
      api.contents.queries.runtime.getExerciseQuestionPage,
      { locale: "id", slug: `${slug}/1` }
    );
    const groupArgs = {
      category: "high-school",
      exerciseType: "try-out",
      locale: "id",
      material: "quantitative-knowledge",
      type: "snbt",
      year: "2026",
    } as const;
    const groupPage = await t.query(
      api.contents.queries.runtime.getExerciseGroupPage,
      groupArgs
    );

    expect(setPage?.exercises).toEqual([
      expect.objectContaining({
        assetId: questionGraph.assetId,
        content_id: questionGraph.content_id,
        choices: {
          en: [{ label: "A. Correct", value: true }],
          id: [{ label: "A. Benar", value: true }],
        },
        number: 1,
        question: expect.objectContaining({ raw: "Question body" }),
        route: `${slug}/1`,
      }),
    ]);
    expect(setPage).toEqual(
      expect.objectContaining({
        assetId: setGraph.assetId,
        content_id: setGraph.content_id,
        route: slug,
      })
    );
    expect(questionPage).toEqual(
      expect.objectContaining({
        exerciseCount: 1,
        exercise: expect.objectContaining({
          assetId: questionGraph.assetId,
          number: 1,
          route: `${slug}/1`,
        }),
        set: expect.objectContaining({
          assetId: setGraph.assetId,
          route: slug,
        }),
      })
    );
    expect(groupPage?.sets.map((set) => set.setName)).toEqual([
      "set-1",
      "set-2",
      "set-10",
    ]);
    expect(groupPage?.sets[0]).toEqual(
      expect.objectContaining({
        assetId: setGraph.assetId,
        content_id: setGraph.content_id,
        questionCount: 1,
        route: slug,
        slug,
        year: "2026",
      })
    );

    await t.mutation(async (ctx) => {
      await deleteContentRouteFixture(ctx, {
        locale: "id",
        route: `${slug}/1`,
      });
    });

    await expect(
      t.query(api.contents.queries.runtime.getExerciseSetPage, {
        locale: "id",
        slug,
      })
    ).resolves.toBeNull();
    await expect(
      t.query(api.contents.queries.runtime.getExerciseQuestionPage, {
        locale: "id",
        slug: `${slug}/1`,
      })
    ).resolves.toBeNull();

    await t.mutation(async (ctx) => {
      await deleteContentRouteFixture(ctx, { locale: "id", route: secondSlug });
    });

    await expect(
      t.query(api.contents.queries.runtime.getExerciseGroupPage, groupArgs)
    ).resolves.toBeNull();
  });

  it("lists API content with segment matching and catalog graph IDs", async () => {
    const t = createConvexTestWithBetterAuth();
    const articleRoute = "articles/politics/api-detached";
    const topicSlug = "material/lesson/chemistry/structure-matter";
    const exactSlug = `${topicSlug}/subatomic-particles`;
    const siblingSlug = `${topicSlug}/subatomic-particles-properties`;
    const articleGraph = detachedContentRouteGraph(articleRoute, "article");
    const exactGraph = detachedContentRouteGraph(exactSlug, "material");

    await t.mutation(async (ctx) => {
      await ctx.db.insert("articleContents", {
        articleSlug: "api-detached",
        body: "## Article body",
        category: "politics",
        contentHash: "api-article-hash",
        date: NOW,
        description: "Article description",
        locale: "id",
        slug: articleRoute,
        syncedAt: NOW,
        title: "API Article",
      });
      await ctx.db.insert("contentRoutes", {
        ...articleGraph,
        authors: [],
        contentHash: "api-article-hash",
        kind: "article",
        locale: "id",
        markdown: true,
        route: articleRoute,
        section: "articles",
        syncedAt: NOW,
        title: "API Article",
      });

      const topicId = await ctx.db.insert("curriculumTopics", {
        locale: "id",
        material: "chemistry",
        order: 0,
        sectionCount: 2,
        slug: topicSlug,
        syncedAt: NOW,
        title: "Structure Matter",
        topic: "structure-matter",
      });

      for (const slug of [exactSlug, siblingSlug]) {
        await ctx.db.insert("curriculumLessons", {
          body: `Body for ${slug}`,
          contentHash: `${slug}:hash`,
          date: NOW,
          locale: "id",
          material: "chemistry",
          order: slug === exactSlug ? 0 : 1,
          section: slug.split("/").at(-1) ?? "",
          slug,
          syncedAt: NOW,
          title: slug === exactSlug ? "Subatomic Particles" : "Properties",
          topic: "structure-matter",
          topicId,
        });
        const graph =
          slug === exactSlug ? exactGraph : contentRouteGraph("id", slug);

        await ctx.db.insert("contentRoutes", {
          ...graph,
          authors: [],
          contentHash: `${slug}:hash`,
          kind: "curriculum-lesson",
          locale: "id",
          markdown: true,
          route: slug,
          section: "material",
          syncedAt: NOW,
          title: slug === exactSlug ? "Subatomic Particles" : "Properties",
        });
      }
    });

    const articlePage = await t.query(
      api.contents.queries.runtime.listArticleApiContentPage,
      {
        cursor: null,
        limit: 100,
        locale: "id",
        prefix: articleRoute,
      }
    );
    const exactPage = await t.query(
      api.contents.queries.runtime.listMaterialApiContentPage,
      {
        cursor: null,
        limit: 100,
        locale: "id",
        prefix: exactSlug,
      }
    );
    const topicPage = await t.query(
      api.contents.queries.runtime.listMaterialApiContentPage,
      {
        cursor: null,
        limit: 100,
        locale: "id",
        prefix: topicSlug,
      }
    );

    expect(exactPage.page.map((item) => item.slug)).toEqual([exactSlug]);
    expect(topicPage.page.map((item) => item.slug).sort()).toEqual([
      exactSlug,
      siblingSlug,
    ]);
    expect(articlePage.page[0]).toEqual(
      expect.objectContaining({
        alignmentId: articleGraph.alignmentId,
        assetId: articleGraph.assetId,
        slug: articleRoute,
      })
    );
    expect(exactPage.page[0]).toEqual(
      expect.objectContaining({
        alignmentId: exactGraph.alignmentId,
        assetId: exactGraph.assetId,
        slug: exactSlug,
      })
    );
  });

  it("lists route catalog rows with exact-or-descendant segment matching", async () => {
    const t = createConvexTestWithBetterAuth();
    const topicSlug = "material/lesson/chemistry/structure-matter";
    const exactSlug = topicSlug;
    const childSlug = `${topicSlug}/subatomic-particles`;
    const siblingSlug = `${topicSlug}/subatomic-particles-properties`;

    await t.mutation(async (ctx) => {
      for (const route of [exactSlug, childSlug, siblingSlug]) {
        const kind = getLearningObjectKindForRoute(route);

        if (!(kind === "curriculum-topic" || kind === "curriculum-lesson")) {
          throw new Error(`Expected curriculum route kind for ${route}.`);
        }

        await ctx.db.insert("contentRoutes", {
          ...contentRouteGraph("id", route),
          authors: [{ name: "Nakafa Author" }],
          contentHash: `${route}:hash`,
          kind,
          locale: "id",
          markdown: true,
          route,
          section: "material",
          syncedAt: NOW,
          title: route,
        });
      }
    });

    const exactPage = await t.query(
      api.contents.queries.runtime.listContentRoutesByPrefix,
      {
        cursor: null,
        limit: 100,
        locale: "id",
        prefix: exactSlug,
        section: "material",
      }
    );
    const topicPage = await t.query(
      api.contents.queries.runtime.listContentRoutesByPrefix,
      {
        cursor: null,
        limit: 100,
        locale: "id",
        prefix: topicSlug,
        section: "material",
      }
    );

    expect(exactPage.page.map((item) => item.route)).toEqual([
      exactSlug,
      childSlug,
      siblingSlug,
    ]);
    expect(new Set(topicPage.page.map((item) => item.route))).toEqual(
      new Set([exactSlug, childSlug, siblingSlug])
    );
  });

  it("lists parent-scoped route rows without descendant bleed", async () => {
    const t = createConvexTestWithBetterAuth();
    const parentRoute = "material/lesson/mathematics";
    const topicRoute = `${parentRoute}/function-transformation`;

    await t.mutation(async (ctx) => {
      for (let index = 0; index < 150; index++) {
        const route = `${parentRoute}/overflow-topic/lesson-${index}`;
        await ctx.db.insert("contentRoutes", {
          ...contentRouteGraph("id", route),
          authors: [{ name: "Nakafa Author" }],
          contentHash: `${route}:hash`,
          depth: route.split("/").length,
          kind: "curriculum-lesson",
          locale: "id",
          markdown: true,
          parentRoute: `${parentRoute}/overflow-topic`,
          route,
          section: "material",
          syncedAt: NOW,
          title: route,
        });
      }

      await ctx.db.insert("contentRoutes", {
        ...contentRouteGraph("id", topicRoute),
        authors: [{ name: "Nakafa Author" }],
        contentHash: `${topicRoute}:hash`,
        depth: topicRoute.split("/").length,
        kind: "curriculum-topic",
        locale: "id",
        markdown: false,
        parentRoute,
        route: topicRoute,
        section: "material",
        syncedAt: NOW,
        title: "Transformasi Fungsi",
      });
    });

    const page = await t.query(
      api.contents.queries.runtime.listContentRoutesByParent,
      {
        cursor: null,
        kind: "curriculum-topic",
        limit: 100,
        locale: "id",
        order: "route",
        parentRoute,
        section: "material",
      }
    );

    expect(page.isDone).toBe(true);
    expect(page.page.map((item) => item.route)).toEqual([topicRoute]);
  });

  it("reads route catalog rows by source path while preserving public routes", async () => {
    const t = createConvexTestWithBetterAuth();
    const sourcePath =
      "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/2";
    const publicPath =
      "latihan/snbt/pengetahuan-kuantitatif/tryout/2026/set-1/soal-2";

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentRoutes", {
        ...contentRouteGraph("id", sourcePath),
        authors: [],
        contentHash: "question-route-hash",
        kind: "exercise-question",
        locale: "id",
        markdown: true,
        route: publicPath,
        section: "material",
        sourcePath,
        syncedAt: NOW,
        title: "Soal 2",
      });
    });

    const route = await t.query(
      api.contents.queries.runtime.getContentRouteBySourcePath,
      {
        locale: "id",
        sourcePath,
      }
    );

    expect(route).toEqual(
      expect.objectContaining({
        kind: "exercise-question",
        route: publicPath,
        sourcePath,
      })
    );
  });

  it("reads source-owned public routes through indexed access patterns", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await ctx.db.insert("publicRoutes", {
        kind: "curriculum-context",
        locale: "id",
        nodeKey: "merdeka:root",
        programKey: "merdeka",
        publicPath: "kurikulum/merdeka",
        sitemap: true,
        syncedAt: NOW,
        title: "Kurikulum Merdeka",
      });
      await ctx.db.insert("publicRoutes", {
        kind: "curriculum-context",
        locale: "id",
        materialDomain: "mathematics",
        nodeKey: "class-10-mathematics",
        parentPath: "kurikulum/merdeka/kelas-10",
        programKey: "merdeka",
        publicPath: "kurikulum/merdeka/kelas-10/matematika",
        sitemap: true,
        syncedAt: NOW,
        title: "Matematika",
      });
      await ctx.db.insert("publicRoutes", {
        canonicalPath: "materi/matematika/integral",
        kind: "curriculum-context",
        locale: "id",
        materialDomain: "mathematics",
        materialKey: "lesson.mathematics.integral",
        nodeKey: "class-12-mathematics-integral",
        parentPath: "kurikulum/merdeka/kelas-12/matematika",
        programKey: "merdeka",
        publicPath: "kurikulum/merdeka/kelas-12/matematika/integral",
        sitemap: true,
        syncedAt: NOW,
        title: "Integral",
      });
      await ctx.db.insert("publicRoutes", {
        kind: "subject-topic",
        locale: "id",
        materialKey: "lesson.mathematics.integral",
        publicPath: "materi/matematika/integral",
        sitemap: true,
        sourcePath: "material/lesson/mathematics/integral",
        syncedAt: NOW,
        title: "Integral",
      });
    });

    const exact = await t.query(
      api.contents.queries.runtime.getPublicRouteByPath,
      {
        locale: "id",
        publicPath: "kurikulum/merdeka/kelas-12/matematika/integral",
      }
    );
    const children = await t.query(
      api.contents.queries.runtime.listPublicRoutesByParent,
      {
        cursor: null,
        kind: "curriculum-context",
        limit: 10,
        locale: "id",
        parentPath: "kurikulum/merdeka/kelas-10",
        programKey: "merdeka",
      }
    );
    const materialRoutes = await t.query(
      api.contents.queries.runtime.listPublicRoutesByMaterial,
      {
        limit: 10,
        locale: "id",
        materialKey: "lesson.mathematics.integral",
      }
    );
    const sitemapRoutes = await t.query(
      api.contents.queries.runtime.listSitemapPublicRoutes,
      {
        cursor: null,
        limit: 10,
        locale: "id",
      }
    );

    expect(exact).toEqual(
      expect.objectContaining({
        canonicalPath: "materi/matematika/integral",
        materialDomain: "mathematics",
        publicPath: "kurikulum/merdeka/kelas-12/matematika/integral",
      })
    );
    expect(children.page.map((item) => item.publicPath)).toEqual([
      "kurikulum/merdeka/kelas-10/matematika",
    ]);
    expect(materialRoutes.map((item) => item.publicPath).sort()).toEqual([
      "kurikulum/merdeka/kelas-12/matematika/integral",
      "materi/matematika/integral",
    ]);
    expect(sitemapRoutes.page.map((item) => item.publicPath).sort()).toEqual([
      "kurikulum/merdeka",
      "kurikulum/merdeka/kelas-10/matematika",
      "kurikulum/merdeka/kelas-12/matematika/integral",
      "materi/matematika/integral",
    ]);
  });

  it("reads materialized route artifact pages and latest route pages from indexed rows", async () => {
    const t = createConvexTestWithBetterAuth();
    const firstRoute = "articles/politics/first";
    const secondRoute = "articles/politics/second";

    await t.mutation(async (ctx) => {
      for (const route of [firstRoute, secondRoute]) {
        await ctx.db.insert("contentRoutes", {
          ...contentRouteGraph("id", route),
          authors: [{ name: "Nakafa Author" }],
          contentHash: `${route}:hash`,
          date: route === firstRoute ? NOW : NOW + 1,
          kind: "article",
          locale: "id",
          markdown: true,
          route,
          section: "articles",
          syncedAt: NOW,
          title: route,
        });
      }

      await ctx.db.insert("contentRoutePages", {
        locale: "id",
        page: 0,
        routeCount: 2,
        routes: [
          contentRoutePageItem(firstRoute),
          contentRoutePageItem(secondRoute),
        ],
        section: "articles",
        syncedAt: NOW,
      });
    });

    const artifactPage = await t.query(
      api.contents.queries.runtime.getContentRouteArtifactPage,
      {
        locale: "id",
        page: 0,
        section: "articles",
      }
    );
    const latest = await t.query(
      api.contents.queries.runtime.listLatestContentRoutes,
      {
        limit: 2,
        locale: "id",
        section: "articles",
      }
    );

    expect(artifactPage?.routes.map((item) => item.route)).toEqual([
      firstRoute,
      secondRoute,
    ]);
    expect(latest.map((item) => item.route)).toEqual([secondRoute, firstRoute]);
  });
});

/** Builds one materialized route artifact fixture item. */
function contentRoutePageItem(route: string) {
  const graph = contentRouteGraph("id", route);

  return {
    ...graph,
    authors: [{ name: "Nakafa Author" }],
    date: route.endsWith("first") ? NOW : NOW + 1,
    kind: "article" as const,
    locale: "id" as const,
    markdown: true,
    route,
    sourcePath: route,
    section: "articles" as const,
    syncedAt: NOW,
    title: route,
  };
}

/** Builds graph identity fields for routes that are valid runtime rows without public graph routes. */
function detachedContentRouteGraph(route: string, token: string) {
  const graph = contentRouteGraph("id", route);
  const assetId = `asset:id:catalog:${token}`;

  return {
    ...graph,
    alignmentId: `alignment:id:catalog:${token}`,
    assetId,
    conceptId: `concept:id:catalog:${token}`,
    content_id: assetId,
    learningObjectId: `lo:id:catalog:${token}`,
    lensId: `lens:id:catalog:${token}`,
  };
}
