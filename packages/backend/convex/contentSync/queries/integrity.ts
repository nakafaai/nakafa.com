import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { contentAuthorContentIdValidator } from "@repo/backend/convex/authors/schema";
import {
  contentTypeValidator,
  localeValidator,
  nakafaSectionValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/_lib/agent/schema/read";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { Schema } from "effect";

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

const graphIdentityTargets = [
  "contentRoutes",
  "contentSearch",
  "contentRoutePages",
  "messageParts",
  "learningViews",
  "learningEngagementQueue",
  "userLearningRecents",
  "learningPopularityViewerSignals",
  "learningPopularitySignals",
  "learningPopularityCounters",
  "audioContentSources",
  "audioGenerationQueue",
  "contentAudios",
] as const;
const graphIdentityTargetValidator = literals(...graphIdentityTargets);

const graphIdentityIssueValidator = v.object({
  assetId: v.optional(v.string()),
  content_ref: v.optional(v.string()),
  content_id: v.optional(v.string()),
  kind: v.optional(v.string()),
  route: v.optional(v.string()),
  section: v.optional(nakafaSectionValidator),
  status: v.optional(v.string()),
});

const graphIdentityFieldsValidator = v.object({
  alignmentId: v.optional(v.string()),
  assetId: v.optional(v.string()),
  conceptId: v.optional(v.string()),
  learningObjectId: v.optional(v.string()),
  lensId: v.optional(v.string()),
});

const graphIdentityRefValidator = v.object({
  ...graphIdentityFieldsValidator.fields,
  content_id: v.optional(v.string()),
  route: v.optional(v.string()),
  section: v.optional(nakafaSectionValidator),
});

const graphIdentityIntegrityPageValidator = v.object({
  checkedRefs: v.number(),
  checkedRefInputs: v.number(),
  continueCursor: v.string(),
  firstInvalidRefInput: v.union(graphIdentityIssueValidator, v.null()),
  firstMissingGraph: v.union(graphIdentityIssueValidator, v.null()),
  firstMismatchedContentId: v.union(graphIdentityIssueValidator, v.null()),
  firstRouteShapedContentId: v.union(graphIdentityIssueValidator, v.null()),
  invalidRefInputs: v.number(),
  isDone: v.boolean(),
  missingGraphRows: v.number(),
  mismatchedContentIds: v.number(),
  routeShapedContentIds: v.number(),
  scannedRows: v.number(),
});

type CurriculumLessonIntegrityItem = Infer<
  typeof curriculumLessonIntegrityItemValidator
>;
type GraphIdentityFields = Infer<typeof graphIdentityFieldsValidator>;
type GraphIdentityRef = Infer<typeof graphIdentityRefValidator>;
type GraphIdentityIssue = Infer<typeof graphIdentityIssueValidator>;
type GraphIdentityIntegrityPage = Infer<
  typeof graphIdentityIntegrityPageValidator
>;
type GraphIdentitySummary = Omit<
  GraphIdentityIntegrityPage,
  "continueCursor" | "isDone" | "scannedRows"
>;
type NakafaDataPart = NonNullable<Doc<"messageParts">["dataNakafaData"]>;
type NakafaContentRefInputPart = Extract<
  NakafaDataPart,
  { input: { content_ref: string } }
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

/** Creates an empty graph identity verifier accumulator. */
function createGraphIdentitySummary(): GraphIdentitySummary {
  return {
    checkedRefInputs: 0,
    checkedRefs: 0,
    firstInvalidRefInput: null,
    firstMissingGraph: null,
    firstMismatchedContentId: null,
    firstRouteShapedContentId: null,
    invalidRefInputs: 0,
    missingGraphRows: 0,
    mismatchedContentIds: 0,
    routeShapedContentIds: 0,
  };
}

/** Returns whether every required graph identity field is present and filled. */
function hasGraphIdentityFields(ref: GraphIdentityFields) {
  return (
    isFilled(ref.alignmentId) &&
    isFilled(ref.assetId) &&
    isFilled(ref.conceptId) &&
    isFilled(ref.learningObjectId) &&
    isFilled(ref.lensId)
  );
}

/** Checks whether a persisted optional string is present and non-empty. */
function isFilled(value: string | undefined) {
  return typeof value === "string" && value.length > 0;
}

/** Detects invalid route-shaped content IDs that violate graph identity storage. */
function hasRouteShapedContentId(ref: GraphIdentityRef) {
  return typeof ref.content_id === "string" && ref.content_id.includes("/");
}

/** Detects graph rows where the persisted content ID is not the graph asset ID. */
function hasMismatchedContentId(ref: GraphIdentityRef) {
  if (!(isFilled(ref.content_id) && isFilled(ref.assetId))) {
    return false;
  }

  return ref.content_id !== ref.assetId;
}

/** Builds the first-invalid-row payload returned by integrity pages. */
function getGraphIdentityIssue(
  ref: GraphIdentityRef,
  kind?: string
): GraphIdentityIssue {
  const issue: GraphIdentityIssue = {};

  if (ref.assetId) {
    issue.assetId = ref.assetId;
  }
  if (ref.content_id) {
    issue.content_id = ref.content_id;
  }
  if (kind) {
    issue.kind = kind;
  }
  if (ref.route) {
    issue.route = ref.route;
  }
  if (ref.section) {
    issue.section = ref.section;
  }

  return issue;
}

/** Adds one graph identity reference to the verifier accumulator. */
function checkGraphIdentityRef(
  summary: GraphIdentitySummary,
  ref: GraphIdentityRef,
  kind?: string
) {
  summary.checkedRefs += 1;

  if (!hasGraphIdentityFields(ref)) {
    summary.missingGraphRows += 1;
    summary.firstMissingGraph ??= getGraphIdentityIssue(ref, kind);
  }

  if (hasRouteShapedContentId(ref)) {
    summary.routeShapedContentIds += 1;
    summary.firstRouteShapedContentId ??= getGraphIdentityIssue(ref, kind);
  }

  if (hasMismatchedContentId(ref)) {
    summary.mismatchedContentIds += 1;
    summary.firstMismatchedContentId ??= getGraphIdentityIssue(ref, kind);
  }
}

/** Verifies a persisted Nakafa input ref uses the current graph ref schema. */
function checkNakafaContentRefInput(
  summary: GraphIdentitySummary,
  data: NakafaContentRefInputPart
) {
  const contentRef = data.input.content_ref;

  summary.checkedRefInputs += 1;

  if (Schema.is(NakafaAgentContentRefInputSchema)(contentRef)) {
    return;
  }

  summary.invalidRefInputs += 1;
  summary.firstInvalidRefInput ??= {
    content_ref: contentRef,
    kind: data.kind,
    status: data.status,
  };
}

/** Adds one chat part preview payload to the graph identity verifier. */
function checkNakafaDataPart(
  summary: GraphIdentitySummary,
  part: Doc<"messageParts">
) {
  const data = part.dataNakafaData;

  if (!data) {
    return;
  }

  switch (data.kind) {
    case "search":
      if (data.status !== "done") {
        return;
      }
      for (const item of data.result.items) {
        checkGraphIdentityRef(summary, item, data.kind);
      }
      return;
    case "content":
      checkNakafaContentRefInput(summary, data);

      if (data.status !== "done") {
        return;
      }

      checkGraphIdentityRef(summary, data.result, data.kind);
      return;
    case "quran":
      if (data.status !== "done") {
        return;
      }
      checkGraphIdentityRef(summary, data.result, data.kind);
      return;
    case "taxonomy":
      return;
    default:
      return;
  }
}

/** Combines verifier counters with Convex pagination state. */
function getGraphIdentityPageResult(
  summary: GraphIdentitySummary,
  page: { continueCursor: string; isDone: boolean; page: unknown[] }
) {
  return {
    ...summary,
    continueCursor: page.continueCursor,
    isDone: page.isDone,
    scannedRows: page.page.length,
  };
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

/** Summarizes strict graph identity invariants for one paginated target slice. */
export const getGraphIdentityIntegrityPage = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    target: graphIdentityTargetValidator,
  },
  returns: graphIdentityIntegrityPageValidator,
  handler: async (ctx, args) => {
    const summary = createGraphIdentitySummary();

    if (args.target === "contentRoutes") {
      const page = await ctx.db
        .query("contentRoutes")
        .paginate(args.paginationOpts);

      for (const row of page.page) {
        checkGraphIdentityRef(summary, row);
      }

      return getGraphIdentityPageResult(summary, page);
    }

    if (args.target === "contentSearch") {
      const page = await ctx.db
        .query("contentSearch")
        .paginate(args.paginationOpts);

      for (const row of page.page) {
        checkGraphIdentityRef(summary, row);
      }

      return getGraphIdentityPageResult(summary, page);
    }

    if (args.target === "contentRoutePages") {
      const page = await ctx.db
        .query("contentRoutePages")
        .paginate(args.paginationOpts);

      for (const row of page.page) {
        for (const route of row.routes) {
          checkGraphIdentityRef(summary, route);
        }
      }

      return getGraphIdentityPageResult(summary, page);
    }

    if (args.target === "learningViews") {
      const page = await ctx.db
        .query("learningViews")
        .paginate(args.paginationOpts);

      for (const row of page.page) {
        checkGraphIdentityRef(summary, row, args.target);
      }

      return getGraphIdentityPageResult(summary, page);
    }

    if (args.target === "learningEngagementQueue") {
      const page = await ctx.db
        .query("learningEngagementQueue")
        .paginate(args.paginationOpts);

      for (const row of page.page) {
        checkGraphIdentityRef(summary, row, args.target);
      }

      return getGraphIdentityPageResult(summary, page);
    }

    if (args.target === "userLearningRecents") {
      const page = await ctx.db
        .query("userLearningRecents")
        .paginate(args.paginationOpts);

      for (const row of page.page) {
        checkGraphIdentityRef(summary, row, args.target);
      }

      return getGraphIdentityPageResult(summary, page);
    }

    if (args.target === "learningPopularitySignals") {
      const page = await ctx.db
        .query("learningPopularitySignals")
        .paginate(args.paginationOpts);

      for (const row of page.page) {
        checkGraphIdentityRef(summary, row, args.target);
      }

      return getGraphIdentityPageResult(summary, page);
    }

    if (args.target === "learningPopularityViewerSignals") {
      const page = await ctx.db
        .query("learningPopularityViewerSignals")
        .paginate(args.paginationOpts);

      for (const row of page.page) {
        checkGraphIdentityRef(summary, row, args.target);
      }

      return getGraphIdentityPageResult(summary, page);
    }

    if (args.target === "learningPopularityCounters") {
      const page = await ctx.db
        .query("learningPopularityCounters")
        .paginate(args.paginationOpts);

      for (const row of page.page) {
        checkGraphIdentityRef(summary, row, args.target);
      }

      return getGraphIdentityPageResult(summary, page);
    }

    if (args.target === "audioContentSources") {
      const page = await ctx.db
        .query("audioContentSources")
        .paginate(args.paginationOpts);

      for (const row of page.page) {
        checkGraphIdentityRef(summary, row, args.target);
      }

      return getGraphIdentityPageResult(summary, page);
    }

    if (args.target === "audioGenerationQueue") {
      const page = await ctx.db
        .query("audioGenerationQueue")
        .paginate(args.paginationOpts);

      for (const row of page.page) {
        checkGraphIdentityRef(summary, row, args.target);
      }

      return getGraphIdentityPageResult(summary, page);
    }

    if (args.target === "contentAudios") {
      const page = await ctx.db
        .query("contentAudios")
        .paginate(args.paginationOpts);

      for (const row of page.page) {
        checkGraphIdentityRef(summary, row, args.target);
      }

      return getGraphIdentityPageResult(summary, page);
    }

    const page = await ctx.db
      .query("messageParts")
      .paginate(args.paginationOpts);

    for (const row of page.page) {
      checkNakafaDataPart(summary, row);
    }

    return getGraphIdentityPageResult(summary, page);
  },
});
