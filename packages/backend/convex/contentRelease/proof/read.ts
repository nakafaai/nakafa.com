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
  PROOF_PAGE_BYTES,
  PROOF_PAGE_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { getConvexSize, type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { Effect } from "effect";

const proofRowValidator = v.object({
  artifactJson: v.optional(v.string()),
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
  function* (ctx: QueryCtx, itemJson: string) {
    const item = yield* decodeItemJson(itemJson);
    if (item.change.operation === "delete") {
      return;
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
    const artifactJson = yield* loadArtifactJson(ctx, row.itemJson);
    const next = {
      artifactJson,
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
