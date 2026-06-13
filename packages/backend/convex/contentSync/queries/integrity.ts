import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { contentAuthorContentIdValidator } from "@repo/backend/convex/authors/schema";
import {
  contentTypeValidator,
  localeValidator,
  type NakafaSection,
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

const graphIdentityTargets = [
  "contentRoutes",
  "contentSearch",
  "contentRoutePages",
  "parts",
  "contentViews",
  "contentViewAnalyticsQueue",
  "articlePopularity",
  "subjectPopularity",
  "exercisePopularity",
  "subjectTrendingBuckets",
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

interface SubjectSectionIntegrityItem {
  locale: Doc<"subjectSections">["locale"];
  slug: string;
  topicId?: Id<"subjectTopics">;
}

interface GraphIdentityFields {
  alignmentId?: string;
  assetId?: string;
  conceptId?: string;
  learningObjectId?: string;
  lensId?: string;
}

interface GraphIdentityRef extends GraphIdentityFields {
  content_id?: string;
  route?: string;
  section?: NakafaSection;
}

type GraphIdentityIssue = Infer<typeof graphIdentityIssueValidator>;
type GraphIdentityIntegrityPage = Infer<
  typeof graphIdentityIntegrityPageValidator
>;
type GraphIdentitySummary = Omit<
  GraphIdentityIntegrityPage,
  "continueCursor" | "isDone" | "scannedRows"
>;
type NakafaDataPart = NonNullable<Doc<"parts">["dataNakafaData"]>;
type NakafaContentRefInputPart = Extract<
  NakafaDataPart,
  { input: { content_ref: string } }
>;

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

function hasGraphIdentityFields(ref: GraphIdentityFields) {
  return (
    isFilled(ref.alignmentId) &&
    isFilled(ref.assetId) &&
    isFilled(ref.conceptId) &&
    isFilled(ref.learningObjectId) &&
    isFilled(ref.lensId)
  );
}

function isFilled(value: string | undefined) {
  return typeof value === "string" && value.length > 0;
}

function hasRouteShapedContentId(ref: GraphIdentityRef) {
  return typeof ref.content_id === "string" && ref.content_id.includes("/");
}

function hasMismatchedContentId(ref: GraphIdentityRef) {
  if (!(isFilled(ref.content_id) && isFilled(ref.assetId))) {
    return false;
  }

  return ref.content_id !== ref.assetId;
}

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

function checkNakafaDataPart(
  summary: GraphIdentitySummary,
  part: Doc<"parts">
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
    case "exercise":
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

    if (args.target === "contentViews") {
      const page = await ctx.db
        .query("contentViews")
        .paginate(args.paginationOpts);

      for (const row of page.page) {
        checkGraphIdentityRef(summary, row, args.target);
      }

      return getGraphIdentityPageResult(summary, page);
    }

    if (args.target === "contentViewAnalyticsQueue") {
      const page = await ctx.db
        .query("contentViewAnalyticsQueue")
        .paginate(args.paginationOpts);

      for (const row of page.page) {
        checkGraphIdentityRef(summary, row, args.target);
      }

      return getGraphIdentityPageResult(summary, page);
    }

    if (args.target === "articlePopularity") {
      const page = await ctx.db
        .query("articlePopularity")
        .paginate(args.paginationOpts);

      for (const row of page.page) {
        checkGraphIdentityRef(
          summary,
          { ...row, section: "articles" },
          args.target
        );
      }

      return getGraphIdentityPageResult(summary, page);
    }

    if (args.target === "subjectPopularity") {
      const page = await ctx.db
        .query("subjectPopularity")
        .paginate(args.paginationOpts);

      for (const row of page.page) {
        checkGraphIdentityRef(
          summary,
          { ...row, section: "subject" },
          args.target
        );
      }

      return getGraphIdentityPageResult(summary, page);
    }

    if (args.target === "exercisePopularity") {
      const page = await ctx.db
        .query("exercisePopularity")
        .paginate(args.paginationOpts);

      for (const row of page.page) {
        checkGraphIdentityRef(
          summary,
          { ...row, section: "exercises" },
          args.target
        );
      }

      return getGraphIdentityPageResult(summary, page);
    }

    if (args.target === "subjectTrendingBuckets") {
      const page = await ctx.db
        .query("subjectTrendingBuckets")
        .paginate(args.paginationOpts);

      for (const row of page.page) {
        checkGraphIdentityRef(
          summary,
          { ...row, section: "subject" },
          args.target
        );
      }

      return getGraphIdentityPageResult(summary, page);
    }

    const page = await ctx.db.query("parts").paginate(args.paginationOpts);

    for (const row of page.page) {
      checkNakafaDataPart(summary, row);
    }

    return getGraphIdentityPageResult(summary, page);
  },
});
