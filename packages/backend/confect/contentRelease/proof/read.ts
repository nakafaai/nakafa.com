import { DatabaseReader } from "@confect/server";
import { MAX_ARTIFACT_BATCH_COUNT } from "@nakafa/aksara-contracts/transport/limits";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadRelease } from "@repo/backend/confect/contentRelease/model";
import {
  decodeItemJson,
  decodeReleaseJson,
} from "@repo/backend/confect/contentRelease/parse";
import { hasProofTransactionHeadroom } from "@repo/backend/confect/contentRelease/proof/budget";
import type {
  artifactProofPageValidator,
  proofPageValidator,
  proofStateValidator,
  routePageValidator,
} from "@repo/backend/confect/contentRelease/proof/read.spec";
import {
  ARTIFACT_PROOF_PAGE_BYTES,
  PROOF_PAGE_BYTES,
  PROOF_PAGE_LIMIT,
} from "@repo/backend/confect/contentRelease/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { getConvexSize } from "convex/values";
import { Effect, Option, type Schema, Struct } from "effect";
export type ProofPage = Schema.Schema.Type<typeof proofPageValidator>;
export type ProofState = Schema.Schema.Type<typeof proofStateValidator>;
export type ArtifactProofPage = Schema.Schema.Type<
  typeof artifactProofPageValidator
>;
export type RouteProofPage = Schema.Schema.Type<typeof routePageValidator>;

/** Reads immutable staged counters after release ingestion has stopped. */
export const stateProgram = Effect.fn("contentRelease.proofState")(function* (
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
export const routePageProgram = Effect.fn("contentRelease.routeProofPage")(
  function* (ctx: QueryCtx, afterIndex: number, releaseId: string) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
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
    const stored = yield* database
      .table("contentBindings")
      .index("by_releaseId_and_index", (query) =>
        query.eq("releaseId", releaseId).gt("index", afterIndex)
      )
      .paginate({
        cursor: null,
        maximumBytesRead: PROOF_PAGE_BYTES,
        maximumRowsRead: PROOF_PAGE_LIMIT,
        numItems: PROOF_PAGE_LIMIT,
      })
      .pipe(Effect.orDie);
    const rows = stored.page.map((row) => ({
      index: row.index,
      routeJson: row.routeJson,
    }));
    return {
      done: stored.isDone,
      nextIndex: rows.at(-1)?.index ?? afterIndex,
      rows,
    };
  }
);

/** Loads the signed artifact referenced by one exact staged upsert. */
export const loadArtifactJson = Effect.fn("contentRelease.loadProofArtifact")(
  function* (ctx: QueryCtx, row: Doc<"contentItems">) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
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
    const artifact = yield* database
      .table("contentArtifacts")
      .get("by_artifactHash", artifactHash)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
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
export const artifactPlanProgram = Effect.fn(
  "contentRelease.artifactProofPlan"
)(function* (ctx: QueryCtx, manifestHash: string, releaseId: string) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  const state = yield* stateProgram(ctx, manifestHash, releaseId);
  const last = yield* database
    .table("contentItems")
    .index(
      "by_releaseId_and_artifactBatchIndex",
      (query) => query.eq("releaseId", releaseId).gte("artifactBatchIndex", 0),
      "desc"
    )
    .first()
    .pipe(Effect.map(Option.getOrNull), Effect.orDie);
  if (state.stagedArtifacts === 0) {
    if (last !== null) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content release ${releaseId} retained an unexpected artifact batch.`
      );
    }
    return {
      batchCount: 0,
      stagedArtifacts: 0,
    };
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
});

/** Reads one immutable publisher-owned artifact batch for isolated checking. */
export const artifactBatchProgram = Effect.fn(
  "contentRelease.artifactProofBatch"
)(function* (ctx: QueryCtx, releaseId: string, batchIndex: number) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
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
  const stored = yield* database
    .table("contentItems")
    .index("by_releaseId_and_artifactBatchIndex", (query) =>
      query.eq("releaseId", releaseId).eq("artifactBatchIndex", batchIndex)
    )
    .take(MAX_ARTIFACT_BATCH_COUNT + 1)
    .pipe(Effect.orDie);
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
  const result = {
    batchIndex,
    rows,
  } satisfies ArtifactProofPage;
  if (getConvexSize(result) > ARTIFACT_PROOF_PAGE_BYTES) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Artifact proof batch ${releaseId}/${batchIndex} exceeds its response ceiling.`
    );
  }
  return result;
});

/** Reads one bounded page for complete-stream Node verification. */
export const pageProgram = Effect.fn("contentRelease.proofPage")(function* (
  ctx: QueryCtx,
  afterIndex: number,
  releaseId: string
) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
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
  const stored = yield* database
    .table("contentItems")
    .index("by_releaseId_and_index", (query) =>
      query.eq("releaseId", releaseId).gt("index", afterIndex)
    )
    .paginate({
      cursor: null,
      maximumBytesRead: PROOF_PAGE_BYTES,
      maximumRowsRead: PROOF_PAGE_LIMIT,
      numItems: PROOF_PAGE_LIMIT,
    })
    .pipe(Effect.orDie);
  const rows: ProofPage["rows"] = [];
  for (const row of stored.page) {
    const next = {
      index: row.index,
      itemJson: row.itemJson,
      ...Struct.pick(row, ["projectionJson"]),
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
