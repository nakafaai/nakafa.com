import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { nakafaSectionValidator } from "@repo/backend/convex/lib/validators/contents";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/_lib/agent/schema/read";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { Schema } from "effect";

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

export const graphIdentityTargetValidator = literals(...graphIdentityTargets);

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

export const graphIdentityIntegrityPageValidator = v.object({
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

type GraphIdentityTarget = Infer<typeof graphIdentityTargetValidator>;
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

/** Checks whether a persisted optional string is present and non-empty. */
function isFilled(value: string | undefined) {
  return typeof value === "string" && value.length > 0;
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

/** Summarizes strict graph identity invariants for one paginated target slice. */
export async function getGraphIdentityIntegrityPageImpl(
  ctx: QueryCtx,
  args: {
    paginationOpts: { cursor: string | null; numItems: number };
    target: GraphIdentityTarget;
  }
) {
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

  if (args.target === "messageParts") {
    const page = await ctx.db
      .query("messageParts")
      .paginate(args.paginationOpts);

    for (const row of page.page) {
      checkNakafaDataPart(summary, row);
    }

    return getGraphIdentityPageResult(summary, page);
  }

  const page = await ctx.db.query(args.target).paginate(args.paginationOpts);

  for (const row of page.page) {
    checkGraphIdentityRef(summary, row, args.target);
  }

  return getGraphIdentityPageResult(summary, page);
}
