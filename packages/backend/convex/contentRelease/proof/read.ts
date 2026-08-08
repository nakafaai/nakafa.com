import { MAX_ARTIFACT_BATCH_COUNT } from "@nakafa/aksara-contracts/transport/limits";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadRelease } from "@repo/backend/convex/contentRelease/model";
import {
  decodeItemJson,
  decodeReleaseJson,
} from "@repo/backend/convex/contentRelease/parse";
import { hasProofTransactionHeadroom } from "@repo/backend/convex/contentRelease/proof/budget";
import {
  ARTIFACT_PROOF_PAGE_BYTES,
  PROOF_PAGE_BYTES,
  PROOF_PAGE_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { getConvexSize, type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { Effect } from "effect";

const proofRowValidator = v.object({
  index: v.number(),
  itemJson: v.string(),
  projectionJson: v.optional(v.string()),
  rollbackJson: v.string(),
});
const proofPageValidator = v.object({
  done: v.boolean(),
  nextIndex: v.number(),
  rows: v.array(proofRowValidator),
});
const proofStateValidator = v.object({
  checkedIndex: v.number(),
  releaseJson: v.string(),
  rendererJson: v.string(),
  role: literals("candidate", "recovery"),
  stagedArtifacts: v.number(),
  stagedDeletes: v.number(),
  stagedItems: v.number(),
  stagedProjections: v.number(),
  stagedRoutes: v.number(),
  stagedSnapshotBatches: v.number(),
  stagedSnapshotRows: v.number(),
  stagedUpserts: v.number(),
  status: literals("verifying", "verified"),
});

export type ProofPage = Infer<typeof proofPageValidator>;
export type ProofState = Infer<typeof proofStateValidator>;

const artifactProofRowValidator = v.object({
  artifactJson: v.string(),
  index: v.number(),
  itemJson: v.string(),
});
const artifactProofPageValidator = v.object({
  batchIndex: v.number(),
  rows: v.array(artifactProofRowValidator),
});
const artifactProofPlanValidator = v.object({
  batchCount: v.number(),
  stagedArtifacts: v.number(),
});
export type ArtifactProofPage = Infer<typeof artifactProofPageValidator>;

const routePageValidator = v.object({
  done: v.boolean(),
  nextIndex: v.number(),
  rows: v.array(v.object({ index: v.number(), routeJson: v.string() })),
});
export type RouteProofPage = Infer<typeof routePageValidator>;

/** Reads immutable staged counters after release ingestion has stopped. */
const stateProgram = Effect.fn("contentRelease.proofState")(function* (
  ctx: QueryCtx,
  manifestHash: string,
  releaseId: string
) {
  const release = yield* loadRelease(ctx, releaseId);
  const signed = yield* decodeReleaseJson(release.releaseJson);
  if (signed.manifestHash !== manifestHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Content release ${releaseId} cannot verify a different manifest hash.`
    );
  }
  if (
    release.abortingAt !== undefined ||
    (release.status !== "verifying" && release.status !== "verified")
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Content release ${releaseId} cannot recompute staged proof from ${release.status}.`
    );
  }
  return {
    checkedIndex: release.checkedIndex,
    releaseJson: release.releaseJson,
    rendererJson: release.rendererJson,
    role: release.role,
    stagedArtifacts: release.stagedArtifacts,
    stagedDeletes: release.stagedDeletes,
    stagedItems: release.stagedItems,
    stagedProjections: release.stagedProjections,
    stagedRoutes: release.stagedRoutes,
    stagedSnapshotBatches: release.stagedSnapshotBatches,
    stagedSnapshotRows: release.stagedSnapshotRows,
    stagedUpserts: release.stagedUpserts,
    status: release.status,
  };
});

/** Reads one bounded canonical route page for complete-stream verification. */
const routePageProgram = Effect.fn("contentRelease.routeProofPage")(function* (
  ctx: QueryCtx,
  afterIndex: number,
  releaseId: string
) {
  if (!Number.isSafeInteger(afterIndex) || afterIndex < -1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Content release ${releaseId} received invalid route cursor.`
    );
  }
  const release = yield* loadRelease(ctx, releaseId);
  if (release.status !== "verifying" && release.status !== "verified") {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Content release ${releaseId} cannot expose proof routes.`
    );
  }
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("contentBindings")
      .withIndex("by_releaseId_and_index", (query) =>
        query.eq("releaseId", releaseId).gt("index", afterIndex)
      )
      .paginate({
        cursor: null,
        maximumBytesRead: PROOF_PAGE_BYTES,
        maximumRowsRead: PROOF_PAGE_LIMIT,
        numItems: PROOF_PAGE_LIMIT,
      })
  );
  const rows = stored.page.map((row) => ({
    index: row.index,
    routeJson: row.routeJson,
  }));
  return {
    done: stored.isDone,
    nextIndex: rows.at(-1)?.index ?? afterIndex,
    rows,
  };
});

/** Loads the signed artifact referenced by one exact staged upsert. */
const loadArtifactJson = Effect.fn("contentRelease.loadProofArtifact")(
  function* (ctx: QueryCtx, row: Doc<"contentItems">) {
    const item = yield* decodeItemJson(row.itemJson);
    if (
      item.change.operation !== "upsert" ||
      !row.artifactReady ||
      row.artifactHash !== item.change.artifactHash
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Artifact proof row ${row.releaseId}/${row.index} lost its staged identity.`
      );
    }
    const artifactHash = item.change.artifactHash;
    const artifact = yield* Effect.promise(() =>
      ctx.db
        .query("contentArtifacts")
        .withIndex("by_artifactHash", (query) =>
          query.eq("artifactHash", artifactHash)
        )
        .unique()
    );
    if (!artifact) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Artifact ${artifactHash} is missing during proof.`
      );
    }
    return artifact.artifactJson;
  }
);

/** Plans immutable artifact batches without replaying their signed bodies. */
const artifactPlanProgram = Effect.fn("contentRelease.artifactProofPlan")(
  function* (ctx: QueryCtx, manifestHash: string, releaseId: string) {
    const state = yield* stateProgram(ctx, manifestHash, releaseId);
    const last = yield* Effect.promise(() =>
      ctx.db
        .query("contentItems")
        .withIndex("by_releaseId_and_artifactBatchIndex", (query) =>
          query.eq("releaseId", releaseId).gte("artifactBatchIndex", 0)
        )
        .order("desc")
        .first()
    );
    if (state.stagedArtifacts === 0) {
      if (last !== null) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Content release ${releaseId} retained an unexpected artifact batch.`
        );
      }
      return { batchCount: 0, stagedArtifacts: 0 };
    }
    const lastBatchIndex = last?.artifactBatchIndex;
    if (
      lastBatchIndex === undefined ||
      !Number.isSafeInteger(lastBatchIndex) ||
      lastBatchIndex < 0 ||
      lastBatchIndex >= state.stagedArtifacts
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content release ${releaseId} lost its artifact batch directory.`
      );
    }
    return {
      batchCount: lastBatchIndex + 1,
      stagedArtifacts: state.stagedArtifacts,
    };
  }
);

/** Reads one immutable publisher-owned artifact batch for isolated checking. */
const artifactBatchProgram = Effect.fn("contentRelease.artifactProofBatch")(
  function* (ctx: QueryCtx, releaseId: string, batchIndex: number) {
    if (!Number.isSafeInteger(batchIndex) || batchIndex < 0) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content release ${releaseId} received invalid artifact batch ${batchIndex}.`
      );
    }
    const release = yield* loadRelease(ctx, releaseId);
    if (
      release.abortingAt !== undefined ||
      (release.status !== "verifying" && release.status !== "verified")
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Content release ${releaseId} cannot expose artifact proof batches.`
      );
    }
    const stored = yield* Effect.promise(() =>
      ctx.db
        .query("contentItems")
        .withIndex("by_releaseId_and_artifactBatchIndex", (query) =>
          query.eq("releaseId", releaseId).eq("artifactBatchIndex", batchIndex)
        )
        .take(MAX_ARTIFACT_BATCH_COUNT + 1)
    );
    if (stored.length === 0 || stored.length > MAX_ARTIFACT_BATCH_COUNT) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content release ${releaseId} has an invalid artifact batch ${batchIndex}.`
      );
    }
    const rows = yield* Effect.forEach(stored, (row) =>
      loadArtifactJson(ctx, row).pipe(
        Effect.map((artifactJson) => ({
          artifactJson,
          index: row.index,
          itemJson: row.itemJson,
        }))
      )
    );
    rows.sort((left, right) => left.index - right.index);
    const result = { batchIndex, rows } satisfies ArtifactProofPage;
    if (getConvexSize(result) > ARTIFACT_PROOF_PAGE_BYTES) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `Artifact proof batch ${releaseId}/${batchIndex} exceeds its response ceiling.`
      );
    }
    return result;
  }
);

/** Reads one bounded page for complete-stream Node verification. */
const pageProgram = Effect.fn("contentRelease.proofPage")(function* (
  ctx: QueryCtx,
  afterIndex: number,
  releaseId: string
) {
  if (!Number.isSafeInteger(afterIndex) || afterIndex < -1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Content release ${releaseId} received invalid proof cursor ${afterIndex}.`
    );
  }
  const release = yield* loadRelease(ctx, releaseId);
  if (
    release.abortingAt !== undefined ||
    (release.status !== "verifying" && release.status !== "verified")
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Content release ${releaseId} is being abandoned during proof.`
    );
  }
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("contentItems")
      .withIndex("by_releaseId_and_index", (query) =>
        query.eq("releaseId", releaseId).gt("index", afterIndex)
      )
      .paginate({
        cursor: null,
        maximumBytesRead: PROOF_PAGE_BYTES,
        maximumRowsRead: PROOF_PAGE_LIMIT,
        numItems: PROOF_PAGE_LIMIT,
      })
  );
  const rows: ProofPage["rows"] = [];
  for (const row of stored.page) {
    const next = {
      index: row.index,
      itemJson: row.itemJson,
      projectionJson: row.projectionJson,
      rollbackJson: row.rollbackJson,
    };
    const candidate = {
      done: false,
      nextIndex: row.index,
      rows: [...rows, next],
    };
    if (getConvexSize(candidate) > PROOF_PAGE_BYTES) {
      if (rows.length === 0) {
        return yield* releaseFail(
          "CONTENT_RELEASE_LIMIT",
          `Proof row ${releaseId}/${row.index} exceeds the page byte ceiling.`
        );
      }
      break;
    }
    rows.push(next);
    const metrics = yield* Effect.promise(() =>
      ctx.meta.getTransactionMetrics()
    );
    if (!hasProofTransactionHeadroom(metrics)) {
      break;
    }
  }
  const nextIndex = rows.at(-1)?.index ?? afterIndex;
  const consumedAll = rows.length === stored.page.length;
  return {
    done: consumedAll && stored.isDone,
    nextIndex,
    rows,
  };
});

/** Returns immutable counters needed to validate one staged digest stream. */
export const state = internalQuery({
  args: { manifestHash: v.string(), releaseId: v.string() },
  returns: proofStateValidator,
  handler: (ctx, args) =>
    runConvexProgram(stateProgram(ctx, args.manifestHash, args.releaseId)),
});

/** Returns the immutable artifact-batch plan for one frozen release. */
export const artifactPlan = internalQuery({
  args: { manifestHash: v.string(), releaseId: v.string() },
  returns: artifactProofPlanValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      artifactPlanProgram(ctx, args.manifestHash, args.releaseId)
    ),
});

/** Returns one exact artifact batch below the Node action response limit. */
export const artifactBatch = internalQuery({
  args: { batchIndex: v.number(), releaseId: v.string() },
  returns: artifactProofPageValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      artifactBatchProgram(ctx, args.releaseId, args.batchIndex)
    ),
});

/** Returns one byte-bounded ordered page with measured transaction headroom. */
export const page = internalQuery({
  args: {
    afterIndex: v.number(),
    releaseId: v.string(),
  },
  returns: proofPageValidator,
  handler: (ctx, args) =>
    runConvexProgram(pageProgram(ctx, args.afterIndex, args.releaseId)),
});

/** Returns one bounded canonical route page for Node verification. */
export const routePage = internalQuery({
  args: { afterIndex: v.number(), releaseId: v.string() },
  returns: routePageValidator,
  handler: (ctx, args) =>
    runConvexProgram(routePageProgram(ctx, args.afterIndex, args.releaseId)),
});
