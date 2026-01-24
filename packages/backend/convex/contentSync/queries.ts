import { internalQuery } from "@repo/backend/convex/_generated/server";
import { v } from "convex/values";

export const getContentCounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const articles = await ctx.db.query("articleContents").collect();
    const subjects = await ctx.db.query("subjectContents").collect();
    const exerciseSets = await ctx.db.query("exerciseSets").collect();
    const exerciseQuestions = await ctx.db.query("exerciseQuestions").collect();
    const authors = await ctx.db.query("authors").collect();
    const contentAuthors = await ctx.db.query("contentAuthors").collect();
    const articleReferences = await ctx.db.query("articleReferences").collect();
    const exerciseChoices = await ctx.db.query("exerciseChoices").collect();

    return {
      articles: articles.length,
      subjects: subjects.length,
      exerciseSets: exerciseSets.length,
      exerciseQuestions: exerciseQuestions.length,
      authors: authors.length,
      contentAuthors: contentAuthors.length,
      articleReferences: articleReferences.length,
      exerciseChoices: exerciseChoices.length,
    };
  },
});

export const getDataIntegrity = internalQuery({
  args: {},
  handler: async (ctx) => {
    const exerciseQuestions = await ctx.db.query("exerciseQuestions").collect();
    const exerciseChoices = await ctx.db.query("exerciseChoices").collect();
    const contentAuthors = await ctx.db.query("contentAuthors").collect();
    const articleReferences = await ctx.db.query("articleReferences").collect();
    const articles = await ctx.db.query("articleContents").collect();

    const questionsWithoutChoices: string[] = [];
    const questionsWithoutAuthors: string[] = [];
    const articlesWithoutReferences: string[] = [];

    for (const question of exerciseQuestions) {
      const choices = exerciseChoices.filter(
        (c) => c.questionId === question._id
      );
      if (choices.length === 0) {
        questionsWithoutChoices.push(`${question.slug} (${question.locale})`);
      }

      const authors = contentAuthors.filter(
        (a) => a.contentId === question._id && a.contentType === "exercise"
      );
      if (authors.length === 0) {
        questionsWithoutAuthors.push(`${question.slug} (${question.locale})`);
      }
    }

    for (const article of articles) {
      const refs = articleReferences.filter((r) => r.articleId === article._id);
      if (refs.length === 0) {
        articlesWithoutReferences.push(`${article.slug} (${article.locale})`);
      }
    }

    return {
      questionsWithoutChoices,
      questionsWithoutAuthors,
      articlesWithoutReferences,
      totalQuestions: exerciseQuestions.length,
      totalArticles: articles.length,
    };
  },
});

export const findStaleContent = internalQuery({
  args: {
    articleSlugs: v.array(v.string()),
    subjectSlugs: v.array(v.string()),
    exerciseSetSlugs: v.array(v.string()),
    exerciseQuestionSlugs: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const articleSlugSet = new Set(args.articleSlugs);
    const subjectSlugSet = new Set(args.subjectSlugs);
    const exerciseSetSlugSet = new Set(args.exerciseSetSlugs);
    const exerciseQuestionSlugSet = new Set(args.exerciseQuestionSlugs);

    const articles = await ctx.db.query("articleContents").collect();
    const subjects = await ctx.db.query("subjectContents").collect();
    const exerciseSets = await ctx.db.query("exerciseSets").collect();
    const exerciseQuestions = await ctx.db.query("exerciseQuestions").collect();

    const staleArticles = articles
      .filter((a) => !articleSlugSet.has(a.slug))
      .map((a) => ({ id: a._id, slug: a.slug, locale: a.locale }));

    const staleSubjects = subjects
      .filter((s) => !subjectSlugSet.has(s.slug))
      .map((s) => ({ id: s._id, slug: s.slug, locale: s.locale }));

    const staleExerciseSets = exerciseSets
      .filter((s) => !exerciseSetSlugSet.has(s.slug))
      .map((s) => ({ id: s._id, slug: s.slug, locale: s.locale }));

    const staleExerciseQuestions = exerciseQuestions
      .filter((q) => !exerciseQuestionSlugSet.has(q.slug))
      .map((q) => ({ id: q._id, slug: q.slug, locale: q.locale }));

    return {
      staleArticles,
      staleSubjects,
      staleExerciseSets,
      staleExerciseQuestions,
    };
  },
});

export const findUnusedAuthors = internalQuery({
  args: {},
  handler: async (ctx) => {
    const authors = await ctx.db.query("authors").collect();
    const contentAuthors = await ctx.db.query("contentAuthors").collect();

    const authorIdsWithContent = new Set(
      contentAuthors.map((ca) => ca.authorId)
    );

    const unusedAuthors = authors
      .filter((a) => !authorIdsWithContent.has(a._id))
      .map((a) => ({ id: a._id, name: a.name, username: a.username }));

    return { unusedAuthors };
  },
});
