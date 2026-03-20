import { internalQuery } from "@repo/backend/convex/_generated/server";
import { getActiveTryoutsWithoutScale } from "@repo/backend/convex/irt/scaleVersions";
import {
  contentTypeValidator,
  localeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";

const countableTableNameValidator = literals(
  "articleContents",
  "subjectTopics",
  "subjectSections",
  "exerciseSets",
  "exerciseQuestions",
  "exerciseAttempts",
  "exerciseAnswers",
  "tryouts",
  "tryoutPartSets",
  "tryoutAttempts",
  "tryoutPartAttempts",
  "tryoutLeaderboardEntries",
  "userTryoutStats",
  "irtCalibrationQueue",
  "irtCalibrationRuns",
  "exerciseItemParameters",
  "irtScalePublicationQueue",
  "irtScaleVersions",
  "irtScaleVersionItems",
  "authors",
  "contentAuthors",
  "articleReferences",
  "exerciseChoices"
);

const countTablePageResultValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  pageSize: v.number(),
});

const staleContentItemValidator = v.object({
  id: v.string(),
  locale: localeValidator,
  slug: v.string(),
});

const staleContentTableNameValidator = literals(
  "articleContents",
  "subjectTopics",
  "subjectSections",
  "exerciseSets",
  "exerciseQuestions"
);

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

const authorSummaryValidator = v.object({
  id: v.string(),
  name: v.string(),
  username: v.string(),
});

const tryoutScaleIntegrityItemValidator = v.object({
  cycleKey: v.string(),
  locale: localeValidator,
  product: tryoutProductValidator,
  slug: v.string(),
});
type TryoutScaleIntegrityItem = Infer<typeof tryoutScaleIntegrityItemValidator>;

export const countTablePage = internalQuery({
  args: {
    tableName: countableTableNameValidator,
    paginationOpts: paginationOptsValidator,
  },
  returns: countTablePageResultValidator,
  handler: async (ctx, args) => {
    switch (args.tableName) {
      case "articleContents": {
        const page = await ctx.db
          .query("articleContents")
          .paginate(args.paginationOpts);
        return {
          continueCursor: page.continueCursor,
          isDone: page.isDone,
          pageSize: page.page.length,
        };
      }
      case "subjectTopics": {
        const page = await ctx.db
          .query("subjectTopics")
          .paginate(args.paginationOpts);
        return {
          continueCursor: page.continueCursor,
          isDone: page.isDone,
          pageSize: page.page.length,
        };
      }
      case "subjectSections": {
        const page = await ctx.db
          .query("subjectSections")
          .paginate(args.paginationOpts);
        return {
          continueCursor: page.continueCursor,
          isDone: page.isDone,
          pageSize: page.page.length,
        };
      }
      case "exerciseSets": {
        const page = await ctx.db
          .query("exerciseSets")
          .paginate(args.paginationOpts);
        return {
          continueCursor: page.continueCursor,
          isDone: page.isDone,
          pageSize: page.page.length,
        };
      }
      case "exerciseQuestions": {
        const page = await ctx.db
          .query("exerciseQuestions")
          .paginate(args.paginationOpts);
        return {
          continueCursor: page.continueCursor,
          isDone: page.isDone,
          pageSize: page.page.length,
        };
      }
      case "exerciseAttempts": {
        const page = await ctx.db
          .query("exerciseAttempts")
          .paginate(args.paginationOpts);
        return {
          continueCursor: page.continueCursor,
          isDone: page.isDone,
          pageSize: page.page.length,
        };
      }
      case "exerciseAnswers": {
        const page = await ctx.db
          .query("exerciseAnswers")
          .paginate(args.paginationOpts);
        return {
          continueCursor: page.continueCursor,
          isDone: page.isDone,
          pageSize: page.page.length,
        };
      }
      case "tryouts": {
        const page = await ctx.db
          .query("tryouts")
          .paginate(args.paginationOpts);
        return {
          continueCursor: page.continueCursor,
          isDone: page.isDone,
          pageSize: page.page.length,
        };
      }
      case "tryoutPartSets": {
        const page = await ctx.db
          .query("tryoutPartSets")
          .paginate(args.paginationOpts);
        return {
          continueCursor: page.continueCursor,
          isDone: page.isDone,
          pageSize: page.page.length,
        };
      }
      case "tryoutAttempts": {
        const page = await ctx.db
          .query("tryoutAttempts")
          .paginate(args.paginationOpts);
        return {
          continueCursor: page.continueCursor,
          isDone: page.isDone,
          pageSize: page.page.length,
        };
      }
      case "tryoutPartAttempts": {
        const page = await ctx.db
          .query("tryoutPartAttempts")
          .paginate(args.paginationOpts);
        return {
          continueCursor: page.continueCursor,
          isDone: page.isDone,
          pageSize: page.page.length,
        };
      }
      case "tryoutLeaderboardEntries": {
        const page = await ctx.db
          .query("tryoutLeaderboardEntries")
          .paginate(args.paginationOpts);
        return {
          continueCursor: page.continueCursor,
          isDone: page.isDone,
          pageSize: page.page.length,
        };
      }
      case "userTryoutStats": {
        const page = await ctx.db
          .query("userTryoutStats")
          .paginate(args.paginationOpts);
        return {
          continueCursor: page.continueCursor,
          isDone: page.isDone,
          pageSize: page.page.length,
        };
      }
      case "irtCalibrationQueue": {
        const page = await ctx.db
          .query("irtCalibrationQueue")
          .paginate(args.paginationOpts);
        return {
          continueCursor: page.continueCursor,
          isDone: page.isDone,
          pageSize: page.page.length,
        };
      }
      case "irtCalibrationRuns": {
        const page = await ctx.db
          .query("irtCalibrationRuns")
          .paginate(args.paginationOpts);
        return {
          continueCursor: page.continueCursor,
          isDone: page.isDone,
          pageSize: page.page.length,
        };
      }
      case "exerciseItemParameters": {
        const page = await ctx.db
          .query("exerciseItemParameters")
          .paginate(args.paginationOpts);
        return {
          continueCursor: page.continueCursor,
          isDone: page.isDone,
          pageSize: page.page.length,
        };
      }
      case "irtScalePublicationQueue": {
        const page = await ctx.db
          .query("irtScalePublicationQueue")
          .paginate(args.paginationOpts);
        return {
          continueCursor: page.continueCursor,
          isDone: page.isDone,
          pageSize: page.page.length,
        };
      }
      case "irtScaleVersions": {
        const page = await ctx.db
          .query("irtScaleVersions")
          .paginate(args.paginationOpts);
        return {
          continueCursor: page.continueCursor,
          isDone: page.isDone,
          pageSize: page.page.length,
        };
      }
      case "irtScaleVersionItems": {
        const page = await ctx.db
          .query("irtScaleVersionItems")
          .paginate(args.paginationOpts);
        return {
          continueCursor: page.continueCursor,
          isDone: page.isDone,
          pageSize: page.page.length,
        };
      }
      case "authors": {
        const page = await ctx.db
          .query("authors")
          .paginate(args.paginationOpts);
        return {
          continueCursor: page.continueCursor,
          isDone: page.isDone,
          pageSize: page.page.length,
        };
      }
      case "contentAuthors": {
        const page = await ctx.db
          .query("contentAuthors")
          .paginate(args.paginationOpts);
        return {
          continueCursor: page.continueCursor,
          isDone: page.isDone,
          pageSize: page.page.length,
        };
      }
      case "articleReferences": {
        const page = await ctx.db
          .query("articleReferences")
          .paginate(args.paginationOpts);
        return {
          continueCursor: page.continueCursor,
          isDone: page.isDone,
          pageSize: page.page.length,
        };
      }
      case "exerciseChoices": {
        const page = await ctx.db
          .query("exerciseChoices")
          .paginate(args.paginationOpts);
        return {
          continueCursor: page.continueCursor,
          isDone: page.isDone,
          pageSize: page.page.length,
        };
      }
      default: {
        throw new Error(`Unsupported count table: ${args.tableName}`);
      }
    }
  },
});

export const getTryoutScaleIntegrity = internalQuery({
  args: {},
  returns: v.object({
    activeTryoutsWithoutScale: v.array(tryoutScaleIntegrityItemValidator),
  }),
  handler: async (ctx) => {
    const tryoutsWithoutScale = await getActiveTryoutsWithoutScale(ctx.db);
    const activeTryoutsWithoutScale: TryoutScaleIntegrityItem[] =
      tryoutsWithoutScale.map((tryout) => ({
        cycleKey: tryout.cycleKey,
        locale: tryout.locale,
        product: tryout.product,
        slug: tryout.slug,
      }));

    return { activeTryoutsWithoutScale };
  },
});

export const listStaleContentPage = internalQuery({
  args: {
    tableName: staleContentTableNameValidator,
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(staleContentItemValidator),
  handler: async (ctx, args) => {
    switch (args.tableName) {
      case "articleContents": {
        const page = await ctx.db
          .query("articleContents")
          .paginate(args.paginationOpts);
        return {
          ...page,
          page: page.page.map((item) => ({
            id: item._id,
            locale: item.locale,
            slug: item.slug,
          })),
        };
      }
      case "subjectTopics": {
        const page = await ctx.db
          .query("subjectTopics")
          .paginate(args.paginationOpts);
        return {
          ...page,
          page: page.page.map((item) => ({
            id: item._id,
            locale: item.locale,
            slug: item.slug,
          })),
        };
      }
      case "subjectSections": {
        const page = await ctx.db
          .query("subjectSections")
          .paginate(args.paginationOpts);
        return {
          ...page,
          page: page.page.map((item) => ({
            id: item._id,
            locale: item.locale,
            slug: item.slug,
          })),
        };
      }
      case "exerciseSets": {
        const page = await ctx.db
          .query("exerciseSets")
          .paginate(args.paginationOpts);
        return {
          ...page,
          page: page.page.map((item) => ({
            id: item._id,
            locale: item.locale,
            slug: item.slug,
          })),
        };
      }
      case "exerciseQuestions": {
        const page = await ctx.db
          .query("exerciseQuestions")
          .paginate(args.paginationOpts);
        return {
          ...page,
          page: page.page.map((item) => ({
            id: item._id,
            locale: item.locale,
            slug: item.slug,
          })),
        };
      }
      default: {
        throw new Error(`Unsupported stale content table: ${args.tableName}`);
      }
    }
  },
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
      page: page.page.map((authorLink) => ({
        authorId: authorLink.authorId,
        contentId: authorLink.contentId,
        contentType: authorLink.contentType,
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

export const listAuthorsPage = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(authorSummaryValidator),
  handler: async (ctx, args) => {
    const page = await ctx.db.query("authors").paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map((author) => ({
        id: author._id,
        name: author.name,
        username: author.username,
      })),
    };
  },
});
