import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { requireCutoverPhase } from "@repo/backend/convex/contentRelease/cutover/state";
import {
  ensureDocumentSize,
  READ_MODEL_DOCUMENT_LIMIT,
} from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadMaterialCatalogOwner } from "@repo/backend/convex/contentRelease/material/owner";
import { deriveMaterialTopicReference } from "@repo/backend/convex/contentRelease/material/topic";
import { verifyEffectiveMaterial } from "@repo/backend/convex/contentRelease/material/verify";
import { Effect } from "effect";

export const MATERIAL_REFERENCE_DOCUMENT_READ_CEILING =
  READ_MODEL_DOCUMENT_LIMIT;
export const MATERIAL_REFERENCE_PAGE_LIMIT = 3;
export const MATERIAL_EFFECTIVE_PROJECTION_ROW_READ_LIMIT = 4;
export const MATERIAL_STAGE_ROW_READ_LIMIT =
  MATERIAL_REFERENCE_PAGE_LIMIT +
  1 +
  MATERIAL_REFERENCE_PAGE_LIMIT * MATERIAL_EFFECTIVE_PROJECTION_ROW_READ_LIMIT;
export const MATERIAL_STAGE_READ_CEILING =
  MATERIAL_STAGE_ROW_READ_LIMIT * MATERIAL_REFERENCE_DOCUMENT_READ_CEILING;

/** Stages one bounded page of authenticated material topic identities. */
export const stageMaterialTopicPage = Effect.fn(
  "contentRelease.cutover.stageMaterialTopicPage"
)(function* (ctx: MutationCtx, expectedCount: number) {
  const state = yield* requireCutoverPhase(ctx, ["quiescent"]);
  yield* requireAuditedMaterialOwner(ctx, state);
  const progress = state.materialReferenceProgress;
  if (progress?.phase === "prove") {
    return pageReceipt(expectedCount, true, 0, 0);
  }
  if (progress !== undefined) {
    const hasValidAssetId = progress.afterAssetId.length > 0;
    const hasValidCount =
      Number.isSafeInteger(progress.checked) &&
      progress.checked > 0 &&
      progress.checked < expectedCount;
    if (!(hasValidAssetId && hasValidCount)) {
      return yield* materialTopicFailure(
        "The durable material staging cursor is invalid."
      );
    }
  }

  const stored = yield* readMaterialPage(ctx, progress?.afterAssetId);
  const page = stored.slice(0, MATERIAL_REFERENCE_PAGE_LIMIT);
  if (page.length === 0) {
    return yield* materialTopicFailure(
      `Material topic staging ended after ${progress?.checked ?? 0} rows.`
    );
  }

  let staged = 0;
  for (const row of page) {
    const { projection } = yield* requireAuditedMaterialRow(ctx, row, state);
    const topic = yield* deriveMaterialTopicReference(projection);
    const topicAssetId = topic.graph.assetId;
    if (row.topicAssetId !== undefined && row.topicAssetId !== topicAssetId) {
      return yield* materialTopicFailure(
        `Material ${row.contentKey}/${row.locale} has different stored topic facts.`
      );
    }
    if (row.topicAssetId !== topicAssetId) {
      yield* ensureDocumentSize(
        `Active material ${row.contentKey}/${row.locale}`,
        { ...row, topicAssetId },
        READ_MODEL_DOCUMENT_LIMIT
      );
      yield* Effect.promise(() =>
        ctx.db.patch("materialCatalog", row._id, { topicAssetId })
      );
      staged += 1;
    }
  }

  const checked = (progress?.checked ?? 0) + page.length;
  const afterAssetId = page.at(-1)?.assetId;
  if (!afterAssetId || checked > expectedCount) {
    return yield* materialTopicFailure(
      "The material staging cursor exceeded its audited inventory."
    );
  }
  const complete = stored.length <= MATERIAL_REFERENCE_PAGE_LIMIT;
  if (complete && checked !== expectedCount) {
    return yield* materialTopicFailure(
      `Material topic staging found ${checked} rows instead of ${expectedCount}.`
    );
  }
  const materialReferenceProgress = complete
    ? {
        checked: 0,
        cursor: null,
        phase: "prove" as const,
        topics: 0,
      }
    : {
        afterAssetId,
        checked,
        phase: "stage" as const,
      };
  yield* Effect.promise(() =>
    ctx.db.patch("contentCutoverState", state._id, {
      materialReferenceProgress,
      updatedAt: Date.now(),
    })
  );
  return pageReceipt(checked, complete, page.length, staged);
});

export const requireAuditedMaterialOwner = Effect.fn(
  "contentRelease.cutover.requireAuditedMaterialOwner"
)(function* (ctx: MutationCtx, state: Doc<"contentCutoverState">) {
  const owner = yield* loadMaterialCatalogOwner(ctx);
  if (
    !(owner.active && owner.ready) ||
    owner.active.releaseId !== state.auditedActiveReleaseId ||
    owner.active.sequence !== state.auditedActiveSequence
  ) {
    return yield* materialTopicFailure(
      "The active signed material read model is unavailable."
    );
  }
});

export const requireAuditedMaterialRow = Effect.fn(
  "contentRelease.cutover.requireAuditedMaterialRow"
)(function* (
  ctx: MutationCtx,
  row: Doc<"materialCatalog">,
  state: Doc<"contentCutoverState">
) {
  return yield* verifyEffectiveMaterial(ctx, row, state.auditedActiveSequence);
});

function readMaterialPage(ctx: MutationCtx, afterAssetId?: string) {
  if (afterAssetId === undefined) {
    return Effect.promise(() =>
      ctx.db
        .query("materialCatalog")
        .withIndex("by_assetId")
        .take(MATERIAL_REFERENCE_PAGE_LIMIT + 1)
    );
  }
  return Effect.promise(() =>
    ctx.db
      .query("materialCatalog")
      .withIndex("by_assetId", (index) => index.gt("assetId", afterAssetId))
      .take(MATERIAL_REFERENCE_PAGE_LIMIT + 1)
  );
}

function pageReceipt(
  checked: number,
  complete: boolean,
  processed: number,
  staged: number
) {
  return { checked, complete, processed, staged };
}

function materialTopicFailure(message: string) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `Material topic reader cutover: ${message}`
  );
}
