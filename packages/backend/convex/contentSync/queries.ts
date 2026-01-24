import { internalQuery } from "@repo/backend/convex/_generated/server";
import { v } from "convex/values";

export const getContentCounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const articles = await ctx.db.query("articleContents").collect();
    const subjects = await ctx.db.query("subjectContents").collect();
    const exercises = await ctx.db.query("exerciseContents").collect();
    const authors = await ctx.db.query("authors").collect();
    const contentAuthors = await ctx.db.query("contentAuthors").collect();
    const articleReferences = await ctx.db.query("articleReferences").collect();
    const exerciseChoices = await ctx.db.query("exerciseChoices").collect();

    return {
      articles: articles.length,
      subjects: subjects.length,
      exercises: exercises.length,
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
    const exercises = await ctx.db.query("exerciseContents").collect();
    const exerciseChoices = await ctx.db.query("exerciseChoices").collect();
    const contentAuthors = await ctx.db.query("contentAuthors").collect();
    const articleReferences = await ctx.db.query("articleReferences").collect();
    const articles = await ctx.db.query("articleContents").collect();

    const exercisesWithoutChoices: string[] = [];
    const exercisesWithoutAuthors: string[] = [];
    const articlesWithoutReferences: string[] = [];

    for (const exercise of exercises) {
      const choices = exerciseChoices.filter(
        (c) => c.exerciseId === exercise._id
      );
      if (choices.length === 0) {
        exercisesWithoutChoices.push(`${exercise.slug} (${exercise.locale})`);
      }

      const authors = contentAuthors.filter(
        (a) => a.contentId === exercise._id && a.contentType === "exercise"
      );
      if (authors.length === 0) {
        exercisesWithoutAuthors.push(`${exercise.slug} (${exercise.locale})`);
      }
    }

    for (const article of articles) {
      const refs = articleReferences.filter((r) => r.articleId === article._id);
      if (refs.length === 0) {
        articlesWithoutReferences.push(`${article.slug} (${article.locale})`);
      }
    }

    return {
      exercisesWithoutChoices,
      exercisesWithoutAuthors,
      articlesWithoutReferences,
      totalExercises: exercises.length,
      totalArticles: articles.length,
    };
  },
});

export const findStaleContent = internalQuery({
  args: {
    articleSlugs: v.array(v.string()),
    subjectSlugs: v.array(v.string()),
    exerciseSlugs: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const articleSlugSet = new Set(args.articleSlugs);
    const subjectSlugSet = new Set(args.subjectSlugs);
    const exerciseSlugSet = new Set(args.exerciseSlugs);

    const articles = await ctx.db.query("articleContents").collect();
    const subjects = await ctx.db.query("subjectContents").collect();
    const exercises = await ctx.db.query("exerciseContents").collect();

    const staleArticles = articles
      .filter((a) => !articleSlugSet.has(a.slug))
      .map((a) => ({ id: a._id, slug: a.slug, locale: a.locale }));

    const staleSubjects = subjects
      .filter((s) => !subjectSlugSet.has(s.slug))
      .map((s) => ({ id: s._id, slug: s.slug, locale: s.locale }));

    const staleExercises = exercises
      .filter((e) => !exerciseSlugSet.has(e.slug))
      .map((e) => ({ id: e._id, slug: e.slug, locale: e.locale }));

    return {
      staleArticles,
      staleSubjects,
      staleExercises,
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
