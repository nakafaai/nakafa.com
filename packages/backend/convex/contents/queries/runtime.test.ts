import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
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
      | Id<"subjectSections">
      | Id<"exerciseQuestions">;
    contentType: "article" | "subject" | "exercise";
  }
) {
  await ctx.db.insert("contentAuthors", {
    authorId: args.authorId,
    contentId: args.contentId,
    contentType: args.contentType,
    order: 0,
  });
}

describe("contents/queries/runtime", () => {
  it("loads article and subject pages from synced runtime rows", async () => {
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

      const topicId = await ctx.db.insert("subjectTopics", {
        category: "high-school",
        grade: "10",
        locale: "id",
        material: "mathematics",
        order: 0,
        sectionCount: 1,
        slug: "subject/high-school/10/mathematics/runtime-topic",
        syncedAt: NOW,
        title: "Runtime Topic",
        topic: "runtime-topic",
      });
      const sectionId = await ctx.db.insert("subjectSections", {
        body: "## Subject body",
        category: "high-school",
        contentHash: "subject-hash",
        date: NOW,
        description: "Subject description",
        grade: "10",
        locale: "id",
        material: "mathematics",
        order: 0,
        section: "runtime-section",
        slug: "subject/high-school/10/mathematics/runtime-topic/runtime-section",
        subject: "Runtime Topic",
        syncedAt: NOW,
        title: "Runtime Subject",
        topic: "runtime-topic",
        topicId,
      });
      await linkAuthor(ctx, {
        authorId,
        contentId: sectionId,
        contentType: "subject",
      });
    });

    const article = await t.query(api.contents.queries.runtime.getArticlePage, {
      locale: "id",
      slug: "articles/politics/runtime-article",
    });
    const subject = await t.query(api.contents.queries.runtime.getSubjectPage, {
      locale: "id",
      slug: "subject/high-school/10/mathematics/runtime-topic/runtime-section",
    });

    expect(article).toEqual(
      expect.objectContaining({
        body: "## Article body",
        metadata: expect.objectContaining({
          authors: [{ name: "Nakafa Author" }],
          date: "01/02/2026",
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

  it("loads exercise set, question, and group pages from indexed rows", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      const authorId = await insertAuthor(ctx);
      const setId = await ctx.db.insert("exerciseSets", {
        category: "high-school",
        description: "Try-out group",
        exerciseType: "try-out",
        locale: "id",
        material: "quantitative-knowledge",
        questionCount: 1,
        setName: "set-1",
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1",
        syncedAt: NOW,
        title: "Set 1",
        type: "snbt",
        year: "2026",
      });
      await ctx.db.insert("exerciseSets", {
        category: "high-school",
        description: "Try-out group",
        exerciseType: "try-out",
        locale: "id",
        material: "quantitative-knowledge",
        questionCount: 1,
        setName: "set-10",
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-10",
        syncedAt: NOW,
        title: "Set 10",
        type: "snbt",
        year: "2026",
      });
      await ctx.db.insert("exerciseSets", {
        category: "high-school",
        description: "Try-out group",
        exerciseType: "try-out",
        locale: "id",
        material: "quantitative-knowledge",
        questionCount: 1,
        setName: "set-2",
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2",
        syncedAt: NOW,
        title: "Set 2",
        type: "snbt",
        year: "2026",
      });
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
        setId,
        setName: "set-1",
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/1",
        syncedAt: NOW,
        title: "Soal 1",
        type: "snbt",
      });
      await linkAuthor(ctx, {
        authorId,
        contentId: questionId,
        contentType: "exercise",
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
    });

    const slug =
      "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1";
    const setPage = await t.query(
      api.contents.queries.runtime.getExerciseSetPage,
      { locale: "id", slug }
    );
    const questionPage = await t.query(
      api.contents.queries.runtime.getExerciseQuestionPage,
      { locale: "id", slug: `${slug}/1` }
    );
    const groupPage = await t.query(
      api.contents.queries.runtime.getExerciseGroupPage,
      {
        category: "high-school",
        exerciseType: "try-out",
        locale: "id",
        material: "quantitative-knowledge",
        type: "snbt",
        year: "2026",
      }
    );

    expect(setPage?.exercises).toEqual([
      expect.objectContaining({
        choices: {
          en: [{ label: "A. Correct", value: true }],
          id: [{ label: "A. Benar", value: true }],
        },
        number: 1,
        question: expect.objectContaining({ raw: "Question body" }),
      }),
    ]);
    expect(questionPage).toEqual(
      expect.objectContaining({
        exerciseCount: 1,
        exercise: expect.objectContaining({ number: 1 }),
      })
    );
    expect(groupPage?.sets.map((set) => set.setName)).toEqual([
      "set-1",
      "set-2",
      "set-10",
    ]);
    expect(groupPage?.sets[0]).toEqual(
      expect.objectContaining({
        questionCount: 1,
        slug,
        year: "2026",
      })
    );
  });

  it("lists API content with exact-or-descendant segment matching", async () => {
    const t = createConvexTestWithBetterAuth();
    const topicSlug = "subject/high-school/10/chemistry/structure-matter";
    const exactSlug = `${topicSlug}/subatomic-particles`;
    const siblingSlug = `${topicSlug}/subatomic-particles-properties`;

    await t.mutation(async (ctx) => {
      const topicId = await ctx.db.insert("subjectTopics", {
        category: "high-school",
        grade: "10",
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
        await ctx.db.insert("subjectSections", {
          body: `Body for ${slug}`,
          category: "high-school",
          contentHash: `${slug}:hash`,
          date: NOW,
          grade: "10",
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
      }
    });

    const exactPage = await t.query(
      api.contents.queries.runtime.listSubjectApiContentPage,
      {
        cursor: null,
        limit: 100,
        locale: "id",
        prefix: exactSlug,
      }
    );
    const topicPage = await t.query(
      api.contents.queries.runtime.listSubjectApiContentPage,
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
  });

  it("lists route catalog rows with exact-or-descendant segment matching", async () => {
    const t = createConvexTestWithBetterAuth();
    const topicSlug = "subject/high-school/10/chemistry/structure-matter";
    const exactSlug = `${topicSlug}/subatomic-particles`;
    const childSlug = `${exactSlug}/lesson`;
    const siblingSlug = `${topicSlug}/subatomic-particles-properties`;

    await t.mutation(async (ctx) => {
      for (const route of [exactSlug, childSlug, siblingSlug]) {
        await ctx.db.insert("contentRoutes", {
          authors: [{ name: "Nakafa Author" }],
          contentHash: `${route}:hash`,
          content_id: `id/${route}`,
          kind: "subject-section",
          locale: "id",
          markdown: true,
          route,
          section: "subject",
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
        section: "subject",
      }
    );
    const topicPage = await t.query(
      api.contents.queries.runtime.listContentRoutesByPrefix,
      {
        cursor: null,
        limit: 100,
        locale: "id",
        prefix: topicSlug,
        section: "subject",
      }
    );

    expect(exactPage.page.map((item) => item.route)).toEqual([
      exactSlug,
      childSlug,
    ]);
    expect(new Set(topicPage.page.map((item) => item.route))).toEqual(
      new Set([exactSlug, childSlug, siblingSlug])
    );
  });

  it("lists parent-scoped route rows without descendant bleed", async () => {
    const t = createConvexTestWithBetterAuth();
    const parentRoute = "subject/high-school/12/mathematics";
    const topicRoute = `${parentRoute}/function-transformation`;

    await t.mutation(async (ctx) => {
      for (let index = 0; index < 150; index++) {
        const route = `${parentRoute}/overflow-topic/lesson-${index}`;
        await ctx.db.insert("contentRoutes", {
          authors: [{ name: "Nakafa Author" }],
          contentHash: `${route}:hash`,
          content_id: `id/${route}`,
          depth: route.split("/").length,
          kind: "subject-section",
          locale: "id",
          markdown: true,
          parentRoute: `${parentRoute}/overflow-topic`,
          route,
          section: "subject",
          syncedAt: NOW,
          title: route,
        });
      }

      await ctx.db.insert("contentRoutes", {
        authors: [{ name: "Nakafa Author" }],
        contentHash: `${topicRoute}:hash`,
        content_id: `id/${topicRoute}`,
        depth: topicRoute.split("/").length,
        kind: "subject-topic",
        locale: "id",
        markdown: false,
        parentRoute,
        route: topicRoute,
        section: "subject",
        syncedAt: NOW,
        title: "Transformasi Fungsi",
      });
    });

    const page = await t.query(
      api.contents.queries.runtime.listContentRoutesByParent,
      {
        cursor: null,
        kind: "subject-topic",
        limit: 100,
        locale: "id",
        order: "route",
        parentRoute,
        section: "subject",
      }
    );

    expect(page.isDone).toBe(true);
    expect(page.page.map((item) => item.route)).toEqual([topicRoute]);
  });

  it("loads subject outlines in authored order instead of creation or slug order", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      const sequenceTopicId = await ctx.db.insert("subjectTopics", {
        category: "high-school",
        description: "Sequence topic",
        grade: "10",
        locale: "id",
        material: "mathematics",
        order: 1,
        sectionCount: 1,
        slug: "subject/high-school/10/mathematics/sequence-series",
        syncedAt: NOW,
        title: "Barisan dan Deret",
        topic: "sequence-series",
      });
      const exponentialTopicId = await ctx.db.insert("subjectTopics", {
        category: "high-school",
        description: "Exponential topic",
        grade: "10",
        locale: "id",
        material: "mathematics",
        order: 0,
        sectionCount: 2,
        slug: "subject/high-school/10/mathematics/exponential-logarithm",
        syncedAt: NOW,
        title: "Eksponen dan Logaritma",
        topic: "exponential-logarithm",
      });

      await ctx.db.insert("subjectSections", {
        body: "Properties body",
        category: "high-school",
        contentHash: "properties-hash",
        date: NOW,
        grade: "10",
        locale: "id",
        material: "mathematics",
        order: 1,
        section: "properties",
        slug: "subject/high-school/10/mathematics/exponential-logarithm/properties",
        syncedAt: NOW,
        title: "Sifat Eksponen",
        topic: "exponential-logarithm",
        topicId: exponentialTopicId,
      });
      await ctx.db.insert("subjectSections", {
        body: "Basic body",
        category: "high-school",
        contentHash: "basic-hash",
        date: NOW,
        grade: "10",
        locale: "id",
        material: "mathematics",
        order: 0,
        section: "basic-concept",
        slug: "subject/high-school/10/mathematics/exponential-logarithm/basic-concept",
        syncedAt: NOW,
        title: "Konsep Eksponen",
        topic: "exponential-logarithm",
        topicId: exponentialTopicId,
      });
      await ctx.db.insert("subjectSections", {
        body: "Sequence body",
        category: "high-school",
        contentHash: "sequence-hash",
        date: NOW,
        grade: "10",
        locale: "id",
        material: "mathematics",
        order: 0,
        section: "sequence-concept",
        slug: "subject/high-school/10/mathematics/sequence-series/sequence-concept",
        syncedAt: NOW,
        title: "Konsep Barisan",
        topic: "sequence-series",
        topicId: sequenceTopicId,
      });
    });

    const outline = await t.query(
      api.contents.queries.runtime.getSubjectOutline,
      {
        category: "high-school",
        grade: "10",
        locale: "id",
        material: "mathematics",
      }
    );

    expect(outline.map((topic) => topic.title)).toEqual([
      "Eksponen dan Logaritma",
      "Barisan dan Deret",
    ]);
    expect(outline[0]?.sections.map((section) => section.title)).toEqual([
      "Konsep Eksponen",
      "Sifat Eksponen",
    ]);
  });

  it("reads materialized route artifact pages and latest route pages from indexed rows", async () => {
    const t = createConvexTestWithBetterAuth();
    const firstRoute = "articles/politics/first";
    const secondRoute = "articles/politics/second";

    await t.mutation(async (ctx) => {
      for (const route of [firstRoute, secondRoute]) {
        await ctx.db.insert("contentRoutes", {
          authors: [{ name: "Nakafa Author" }],
          contentHash: `${route}:hash`,
          content_id: `id/${route}`,
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
  return {
    authors: [{ name: "Nakafa Author" }],
    content_id: `id/${route}`,
    date: route.endsWith("first") ? NOW : NOW + 1,
    kind: "article" as const,
    locale: "id" as const,
    markdown: true,
    route,
    section: "articles" as const,
    syncedAt: NOW,
    title: route,
  };
}
