import { internalQuery } from "@repo/backend/convex/_generated/server";
import {
  contentTypeValidator,
  localeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";

const staleContentItemValidator = v.object({
  id: v.string(),
  locale: localeValidator,
  slug: v.string(),
});

const exerciseQuestionIntegrityItemValidator = v.object({
  id: v.string(),
  locale: localeValidator,
  slug: v.string(),
});

const exerciseChoiceIntegrityItemValidator = v.object({
  questionId: v.string(),
});

const contentAuthorIntegrityItemValidator = v.object({
  authorId: v.string(),
  contentId: v.string(),
  contentType: contentTypeValidator,
});

const articleReferenceIntegrityItemValidator = v.object({
  articleId: v.string(),
});

const subjectSectionIntegrityItemValidator = v.object({
  locale: localeValidator,
  slug: v.string(),
  topicId: v.optional(v.string()),
});

export const listIntegrityExerciseQuestionsPage = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(exerciseQuestionIntegrityItemValidator),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("exerciseQuestions")
      .paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map((question) => ({
        id: question._id,
        locale: question.locale,
        slug: question.slug,
      })),
    };
  },
});

export const listIntegrityExerciseChoicesPage = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(exerciseChoiceIntegrityItemValidator),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("exerciseChoices")
      .paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map((choice) => ({
        questionId: choice.questionId,
      })),
    };
  },
});

export const listIntegrityContentAuthorsPage = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(contentAuthorIntegrityItemValidator),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("contentAuthors")
      .paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map((contentAuthor) => ({
        authorId: contentAuthor.authorId,
        contentId: contentAuthor.contentId,
        contentType: contentAuthor.contentType,
      })),
    };
  },
});

export const listIntegrityArticleReferencesPage = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(articleReferenceIntegrityItemValidator),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("articleReferences")
      .paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map((reference) => ({
        articleId: reference.articleId,
      })),
    };
  },
});

export const listIntegrityArticlesPage = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(staleContentItemValidator),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("articleContents")
      .paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map((article) => ({
        id: article._id,
        locale: article.locale,
        slug: article.slug,
      })),
    };
  },
});

export const listIntegritySubjectSectionsPage = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(subjectSectionIntegrityItemValidator),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("subjectSections")
      .paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map((section) => ({
        locale: section.locale,
        slug: section.slug,
        topicId: section.topicId,
      })),
    };
  },
});
