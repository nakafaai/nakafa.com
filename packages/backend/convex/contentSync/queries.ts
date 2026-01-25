import { internalQuery } from "@repo/backend/convex/_generated/server";
import { v } from "convex/values";

export const getContentCounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const articles = await ctx.db.query("articleContents").collect();
    const subjectTopics = await ctx.db.query("subjectTopics").collect();
    const subjectSections = await ctx.db.query("subjectSections").collect();
    const exerciseSets = await ctx.db.query("exerciseSets").collect();
    const exerciseQuestions = await ctx.db.query("exerciseQuestions").collect();
    const authors = await ctx.db.query("authors").collect();
    const contentAuthors = await ctx.db.query("contentAuthors").collect();
    const articleReferences = await ctx.db.query("articleReferences").collect();
    const exerciseChoices = await ctx.db.query("exerciseChoices").collect();

    return {
      articles: articles.length,
      subjectTopics: subjectTopics.length,
      subjectSections: subjectSections.length,
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
    const subjectSections = await ctx.db.query("subjectSections").collect();

    const questionsWithoutChoices: string[] = [];
    const questionsWithoutAuthors: string[] = [];
    const articlesWithoutReferences: string[] = [];
    const sectionsWithoutTopics: string[] = [];

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

    for (const section of subjectSections) {
      if (!section.topicId) {
        sectionsWithoutTopics.push(`${section.slug} (${section.locale})`);
      }
    }

    return {
      questionsWithoutChoices,
      questionsWithoutAuthors,
      articlesWithoutReferences,
      sectionsWithoutTopics,
      totalQuestions: exerciseQuestions.length,
      totalArticles: articles.length,
      totalSections: subjectSections.length,
    };
  },
});

export const findStaleContent = internalQuery({
  args: {
    articleSlugs: v.array(v.string()),
    subjectTopicSlugs: v.array(v.string()),
    subjectSectionSlugs: v.array(v.string()),
    exerciseSetSlugs: v.array(v.string()),
    exerciseQuestionSlugs: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const articleSlugSet = new Set(args.articleSlugs);
    const subjectTopicSlugSet = new Set(args.subjectTopicSlugs);
    const subjectSectionSlugSet = new Set(args.subjectSectionSlugs);
    const exerciseSetSlugSet = new Set(args.exerciseSetSlugs);
    const exerciseQuestionSlugSet = new Set(args.exerciseQuestionSlugs);

    const articles = await ctx.db.query("articleContents").collect();
    const subjectTopics = await ctx.db.query("subjectTopics").collect();
    const subjectSections = await ctx.db.query("subjectSections").collect();
    const exerciseSets = await ctx.db.query("exerciseSets").collect();
    const exerciseQuestions = await ctx.db.query("exerciseQuestions").collect();

    const staleArticles = articles
      .filter((a) => !articleSlugSet.has(a.slug))
      .map((a) => ({ id: a._id, slug: a.slug, locale: a.locale }));

    const staleSubjectTopics = subjectTopics
      .filter((t) => !subjectTopicSlugSet.has(t.slug))
      .map((t) => ({ id: t._id, slug: t.slug, locale: t.locale }));

    const staleSubjectSections = subjectSections
      .filter((s) => !subjectSectionSlugSet.has(s.slug))
      .map((s) => ({ id: s._id, slug: s.slug, locale: s.locale }));

    const staleExerciseSets = exerciseSets
      .filter((s) => !exerciseSetSlugSet.has(s.slug))
      .map((s) => ({ id: s._id, slug: s.slug, locale: s.locale }));

    const staleExerciseQuestions = exerciseQuestions
      .filter((q) => !exerciseQuestionSlugSet.has(q.slug))
      .map((q) => ({ id: q._id, slug: q.slug, locale: q.locale }));

    return {
      staleArticles,
      staleSubjectTopics,
      staleSubjectSections,
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
