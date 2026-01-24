import { internalQuery } from "@repo/backend/convex/_generated/server";

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
