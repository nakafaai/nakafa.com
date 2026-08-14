import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import {
  AUDITED_MATERIAL_COUNT,
  AUDITED_MATERIAL_TOPIC_COUNT,
} from "@repo/backend/convex/contentRelease/cutover/inventory";
import {
  MATERIAL_REFERENCE_DOCUMENT_READ_CEILING,
  MATERIAL_REFERENCE_PAGE_LIMIT,
  requireAuditedMaterialOwner,
  requireAuditedMaterialRow,
  stageMaterialTopicPage,
} from "@repo/backend/convex/contentRelease/cutover/materialTopics";
import { persistReferenceProof } from "@repo/backend/convex/contentRelease/cutover/referenceProofs";
import { requireCutoverPhase } from "@repo/backend/convex/contentRelease/cutover/state";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { deriveMaterialTopicReference } from "@repo/backend/convex/contentRelease/material/topic";
import { verifyMaterial } from "@repo/backend/convex/contentRelease/material/verify";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

export const MATERIAL_PROOF_ROW_READ_LIMIT = MATERIAL_REFERENCE_PAGE_LIMIT * 6;
export const MATERIAL_PROOF_READ_CEILING =
  MATERIAL_PROOF_ROW_READ_LIMIT * MATERIAL_REFERENCE_DOCUMENT_READ_CEILING;

const materialReferencePageValidator = v.object({
  checked: v.number(),
  complete: v.boolean(),
  phase: v.union(v.literal("stage"), v.literal("prove"), v.literal("complete")),
  processed: v.number(),
  staged: v.number(),
  topics: v.number(),
});

type ActiveTopic = NonNullable<
  Extract<
    NonNullable<Doc<"contentCutoverState">["materialReferenceProgress"]>,
    { readonly phase: "prove" }
  >["activeTopic"]
>;

/** Stages and proves one bounded material reference page. */
export const checkpointMaterialReferencePage = Effect.fn(
  "contentRelease.cutover.checkpointMaterialReferencePage"
)(function* (
  ctx: MutationCtx,
  expectedCount: number,
  expectedTopicCount: number
) {
  const state = yield* requireCutoverPhase(ctx, ["quiescent"]);
  yield* requireAuditedMaterialOwner(ctx, state);
  if (
    state.materialReferenceProof !== undefined ||
    state.materialTopicReferenceProof !== undefined
  ) {
    if (
      state.materialReferenceProgress !== undefined ||
      state.materialReferenceProof?.count !== expectedCount ||
      state.materialTopicReferenceProof?.count !== expectedTopicCount ||
      state.materialReferenceProof.provedAt < state.auditedAt ||
      state.materialTopicReferenceProof.provedAt < state.auditedAt
    ) {
      return yield* materialAssetFailure(
        "The completed material reference checkpoint is inconsistent."
      );
    }
    return receipt("complete", expectedCount, expectedTopicCount, 0, 0, true);
  }

  const progress = state.materialReferenceProgress;
  if (progress?.phase !== "prove") {
    const staged = yield* stageMaterialTopicPage(ctx, expectedCount);
    return receipt("stage", staged.checked, 0, staged.processed, staged.staged);
  }
  if (
    !Number.isSafeInteger(progress.checked) ||
    progress.checked < 0 ||
    progress.checked >= expectedCount ||
    !Number.isSafeInteger(progress.topics) ||
    progress.topics < 0 ||
    progress.topics > expectedTopicCount
  ) {
    return yield* materialAssetFailure(
      "The durable material proof cursor is invalid."
    );
  }

  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("materialCatalog")
      .withIndex("by_topicAssetId_and_assetId")
      .paginate({
        cursor: progress.cursor,
        maximumBytesRead:
          MATERIAL_REFERENCE_PAGE_LIMIT *
          MATERIAL_REFERENCE_DOCUMENT_READ_CEILING,
        maximumRowsRead: MATERIAL_REFERENCE_PAGE_LIMIT,
        numItems: MATERIAL_REFERENCE_PAGE_LIMIT,
      })
  );
  if (stored.page.length === 0) {
    return yield* materialAssetFailure(
      `Material proof ended after ${progress.checked} rows.`
    );
  }

  let activeTopic = progress.activeTopic;
  let topics = progress.topics;
  for (const row of stored.page) {
    yield* requireAuditedMaterialRow(row, state);
    const { projection } = yield* verifyMaterial(row);
    const topic = yield* deriveMaterialTopicReference(projection);
    if (row.topicAssetId !== topic.graph.assetId) {
      return yield* materialAssetFailure(
        `Material ${row.contentKey}/${row.locale} has an invalid topic asset.`
      );
    }
    const currentTopic = toActiveTopic(topic, row);
    if (activeTopic?.topicAssetId === currentTopic.topicAssetId) {
      if (!hasSameTopic(activeTopic, currentTopic)) {
        return yield* materialAssetFailure(
          `Material topic ${topic.graph.assetId} has conflicting signed facts.`
        );
      }
    } else {
      topics += 1;
      yield* proveMaterialTopicIndex(ctx, row, currentTopic);
    }
    activeTopic = currentTopic;
    yield* proveMaterialIndexes(ctx, row);
  }

  const checked = progress.checked + stored.page.length;
  if (checked > expectedCount || topics > expectedTopicCount) {
    return yield* materialAssetFailure(
      "The material proof exceeded its audited inventory."
    );
  }
  if (!stored.isDone) {
    yield* Effect.promise(() =>
      ctx.db.patch("contentCutoverState", state._id, {
        materialReferenceProgress: {
          activeTopic,
          checked,
          cursor: stored.continueCursor,
          phase: "prove",
          topics,
        },
        updatedAt: Date.now(),
      })
    );
    return receipt("prove", checked, topics, stored.page.length, 0);
  }
  if (checked !== expectedCount || topics !== expectedTopicCount) {
    return yield* materialAssetFailure(
      `Material proof found ${checked} lessons and ${topics} topics.`
    );
  }

  yield* persistReferenceProof(ctx, "material", checked, expectedCount);
  yield* persistReferenceProof(
    ctx,
    "materialTopic",
    topics,
    expectedTopicCount
  );
  yield* Effect.promise(() =>
    ctx.db.patch("contentCutoverState", state._id, {
      materialReferenceProgress: undefined,
    })
  );
  return receipt("complete", checked, topics, stored.page.length, 0, true);
});

/** Bounded production checkpoint; invoke repeatedly until complete. */
export const checkpoint = internalMutation({
  args: {},
  returns: materialReferencePageValidator,
  handler: (ctx) =>
    runConvexProgram(
      checkpointMaterialReferencePage(
        ctx,
        AUDITED_MATERIAL_COUNT,
        AUDITED_MATERIAL_TOPIC_COUNT
      )
    ),
});

/** Proves permanent lesson indexes select the authenticated source row. */
const proveMaterialIndexes = Effect.fn(
  "contentRelease.cutover.proveMaterialIndexes"
)(function* (ctx: MutationCtx, row: Doc<"materialCatalog">) {
  const [assetRows, routeRows] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db
        .query("materialCatalog")
        .withIndex("by_assetId", (index) => index.eq("assetId", row.assetId))
        .take(2)
    ),
    Effect.promise(() =>
      ctx.db
        .query("materialCatalog")
        .withIndex("by_locale_and_publicPath", (index) =>
          index.eq("locale", row.locale).eq("publicPath", row.publicPath)
        )
        .take(2)
    ),
  ]);
  if (
    assetRows.length !== 1 ||
    assetRows[0]?._id !== row._id ||
    routeRows.length !== 1 ||
    routeRows[0]?._id !== row._id
  ) {
    return yield* materialAssetFailure(
      `Material ${row.contentKey}/${row.locale} does not resolve exactly.`
    );
  }
});

/** Proves a topic prefix selects its first authenticated lesson. */
const proveMaterialTopicIndex = Effect.fn(
  "contentRelease.cutover.proveMaterialTopicIndex"
)(function* (
  ctx: MutationCtx,
  row: Doc<"materialCatalog">,
  topic: ActiveTopic
) {
  const indexed = yield* Effect.promise(() =>
    ctx.db
      .query("materialCatalog")
      .withIndex("by_topicAssetId_and_assetId", (index) =>
        index.eq("topicAssetId", topic.topicAssetId)
      )
      .first()
  );
  if (indexed?._id !== row._id) {
    return yield* materialAssetFailure(
      `Material topic ${topic.topicAssetId} does not resolve exactly.`
    );
  }
});

function toActiveTopic(
  topic: Effect.Effect.Success<ReturnType<typeof deriveMaterialTopicReference>>,
  row: Doc<"materialCatalog">
): ActiveTopic {
  return {
    locale: row.locale,
    publicPath: topic.publicPath,
    title: topic.title,
    topicAlignmentId: topic.graph.alignmentId,
    topicAssetId: topic.graph.assetId,
    topicConceptId: topic.graph.conceptId,
    topicLearningObjectId: topic.graph.learningObjectId,
    topicLensId: topic.graph.lensId,
  };
}

function hasSameTopic(left: ActiveTopic, right: ActiveTopic) {
  return (
    left.topicAlignmentId === right.topicAlignmentId &&
    left.topicAssetId === right.topicAssetId &&
    left.topicConceptId === right.topicConceptId &&
    left.topicLearningObjectId === right.topicLearningObjectId &&
    left.topicLensId === right.topicLensId &&
    left.locale === right.locale &&
    left.publicPath === right.publicPath &&
    left.title === right.title
  );
}

function receipt(
  phase: "complete" | "prove" | "stage",
  checked: number,
  topics: number,
  processed: number,
  staged: number,
  complete = false
) {
  return { checked, complete, phase, processed, staged, topics };
}

function materialAssetFailure(message: string) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `Material reader cutover: ${message}`
  );
}
