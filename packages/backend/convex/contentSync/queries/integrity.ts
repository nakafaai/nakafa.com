import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { contentAuthorContentIdValidator } from "@repo/backend/convex/authors/schema";
import {
  getGraphIdentityIntegrityPageImpl,
  graphIdentityIntegrityPageValidator,
  graphIdentityTargetValidator,
} from "@repo/backend/convex/contentSync/integrity/graph";
import {
  listIntegrityTryoutScalesPageImpl,
  tryoutScaleIntegrityItemValidator,
} from "@repo/backend/convex/contentSync/integrity/tryouts";
import {
  contentTypeValidator,
  localeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";

const staleContentItemValidator = v.object({
  id: v.id("articleContents"),
  locale: localeValidator,
  sourcePath: v.string(),
});

const questionIntegrityItemValidator = v.object({
  id: v.id("questions"),
  locale: localeValidator,
  sourcePath: v.string(),
});

const questionChoiceIntegrityItemValidator = v.object({
  questionId: v.id("questions"),
});

const contentAuthorIntegrityItemValidator = v.object({
  authorId: v.id("authors"),
  contentId: contentAuthorContentIdValidator,
  contentType: contentTypeValidator,
});

const articleReferenceIntegrityItemValidator = v.object({
  articleId: v.id("articleContents"),
});

const curriculumLessonIntegrityItemValidator = v.object({
  locale: localeValidator,
  slug: v.string(),
  topicId: v.optional(v.id("curriculumTopics")),
});

type CurriculumLessonIntegrityItem = Infer<
  typeof curriculumLessonIntegrityItemValidator
>;

/** Maps a curriculum lesson row into the optional diagnostic integrity shape. */
function getCurriculumLessonIntegrityItem(
  section: Doc<"curriculumLessons">
): CurriculumLessonIntegrityItem {
  const item: CurriculumLessonIntegrityItem = {
    locale: section.locale,
    slug: section.slug,
  };

  if (section.topicId) {
    item.topicId = section.topicId;
  }

  return item;
}

/** Returns one bounded question page for sync integrity verification. */
export const listIntegrityQuestionsPage = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(questionIntegrityItemValidator),
  handler: async (ctx, args) => {
    const page = await ctx.db.query("questions").paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map((question) => ({
        id: question._id,
        locale: question.locale,
        sourcePath: question.sourcePath,
      })),
    };
  },
});

/** Returns one bounded question-choice page for sync integrity verification. */
export const listIntegrityQuestionChoicesPage = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(questionChoiceIntegrityItemValidator),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("questionChoices")
      .paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map((choice) => ({
        questionId: choice.questionId,
      })),
    };
  },
});

/** Returns one bounded content-author page for sync integrity verification. */
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

/** Returns one bounded article-reference page for sync integrity verification. */
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

/** Returns one bounded article page for stale-content integrity verification. */
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
        sourcePath: article.slug,
      })),
    };
  },
});

/** Returns one bounded curriculum-lesson page for sync integrity verification. */
export const listIntegrityCurriculumLessonsPage = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(curriculumLessonIntegrityItemValidator),
  /** Returns curriculum lesson rows in the optional shape declared by the integrity validator. */
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("curriculumLessons")
      .paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map(getCurriculumLessonIntegrityItem),
    };
  },
});

/** Returns one bounded try-out scale page for sync integrity verification. */
export const listIntegrityTryoutScalesPage = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(tryoutScaleIntegrityItemValidator),
  handler: listIntegrityTryoutScalesPageImpl,
});

/** Summarizes strict graph identity invariants for one paginated target slice. */
export const getGraphIdentityIntegrityPage = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    target: graphIdentityTargetValidator,
  },
  returns: graphIdentityIntegrityPageValidator,
  handler: getGraphIdentityIntegrityPageImpl,
});
