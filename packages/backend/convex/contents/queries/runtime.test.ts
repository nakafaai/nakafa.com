import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { describe, expect, it } from "vitest";

const NOW = Date.parse("2026-01-02T00:00:00.000Z");

async function insertAuthor(ctx: MutationCtx) {
  return await ctx.db.insert("authors", {
    name: "Nakafa Author",
    username: "nakafa-author",
  });
}

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
        label: "A. Correct",
        locale: "id",
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
        choices: { en: [], id: [{ label: "A. Correct", value: true }] },
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
    expect(groupPage?.sets).toEqual([
      expect.objectContaining({
        questionCount: 1,
        slug,
        year: "2026",
      }),
    ]);
  });
});
