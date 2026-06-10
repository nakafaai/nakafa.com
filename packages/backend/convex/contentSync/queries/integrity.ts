import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { contentAuthorContentIdValidator } from "@repo/backend/convex/authors/schema";
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
  id: v.id("articleContents"),
  locale: localeValidator,
  slug: v.string(),
});

const exerciseQuestionIntegrityItemValidator = v.object({
  id: v.id("exerciseQuestions"),
  locale: localeValidator,
  slug: v.string(),
});

const exerciseChoiceIntegrityItemValidator = v.object({
  questionId: v.id("exerciseQuestions"),
});

const contentAuthorIntegrityItemValidator = v.object({
  authorId: v.id("authors"),
  contentId: contentAuthorContentIdValidator,
  contentType: contentTypeValidator,
});

const articleReferenceIntegrityItemValidator = v.object({
  articleId: v.id("articleContents"),
});

const subjectSectionIntegrityItemValidator = v.object({
  locale: localeValidator,
  slug: v.string(),
  topicId: v.optional(v.id("subjectTopics")),
});

interface SubjectSectionIntegrityItem {
  locale: Doc<"subjectSections">["locale"];
  slug: string;
  topicId?: Id<"subjectTopics">;
}

/** Maps a subject section row into the optional diagnostic integrity shape. */
function getSubjectSectionIntegrityItem(
  section: Doc<"subjectSections">
): SubjectSectionIntegrityItem {
  const item: SubjectSectionIntegrityItem = {
    locale: section.locale,
    slug: section.slug,
  };

  if (section.topicId) {
    item.topicId = section.topicId;
  }

  return item;
}

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
  /** Returns subject section rows in the optional shape declared by the integrity validator. */
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("subjectSections")
      .paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map(getSubjectSectionIntegrityItem),
    };
  },
});
