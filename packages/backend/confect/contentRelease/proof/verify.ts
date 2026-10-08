"use node";

import type { ReleaseVerificationEvidence } from "@nakafa/aksara-contracts/release";
import { verifyResultCatalog } from "@nakafa/aksara-contracts/release/result/digest";
import { verifyContentRoutes } from "@nakafa/aksara-contracts/release/route/verify";
import { verifySignedContentRelease } from "@nakafa/aksara-contracts/release/verify";
import { validateRendererManifestHash } from "@nakafa/aksara-contracts/renderer/manifest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  decodeReleaseJson,
  decodeRendererJson,
} from "@repo/backend/confect/contentRelease/parse";
import { verifyArtifactBatch } from "@repo/backend/confect/contentRelease/proof/artifact";
import { verifyContentStreams } from "@repo/backend/confect/contentRelease/proof/content";
import { contractFailure } from "@repo/backend/confect/contentRelease/proof/failure";
import type { RouteCatalogPage } from "@repo/backend/confect/contentRelease/proof/routes";
import { verifyReleaseSnapshots } from "@repo/backend/confect/contentRelease/proof/snapshot";
import {
  readProofStream,
  readResultStream,
  readRouteStream,
} from "@repo/backend/confect/contentRelease/proof/stream";
import type {
  progressValidator,
  statusValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { Effect, Schema } from "effect";
export type Progress = typeof progressValidator.Type;
export type Status = typeof statusValidator.Type;
/** Stores the proof as the exact JSON text that the commit compares byte for byte. */
const ProofJsonSchema = Schema.fromJsonString(Schema.Unknown);
/** Authenticates the frozen release and renderer identity shared by proof steps. */
export const loadProofIdentity = Effect.fn("contentRelease.loadProofIdentity")(
  function* (manifestHash: string, releaseId: string) {
    const { runQuery } = yield* QueryRunner;
    const state = yield* runQuery(
      refs.internal.contentRelease.proof.read.state,
      {
        manifestHash,
        releaseId,
      }
    ).pipe(Effect.catchTag("SchemaError", Effect.die));
    const storedRelease = yield* decodeReleaseJson(state.releaseJson);
    const release = yield* verifySignedContentRelease(storedRelease).pipe(
      Effect.mapError(contractFailure)
    );
    const storedRenderer = yield* decodeRendererJson(state.rendererJson);
    const renderer = yield* validateRendererManifestHash(storedRenderer).pipe(
      Effect.mapError(contractFailure)
    );
    if (release.manifest.rendererManifestHash !== renderer.hash) {
      return yield* releaseFail(
        "CONTENT_RELEASE_UNSUPPORTED",
        `Content release ${releaseId} no longer matches its frozen renderer.`
      );
    }
    return {
      release,
      renderer,
      state,
    };
  }
);

/** Advances exact item verification from the durable server cursor. */
export const verifyStoredItems = Effect.fn("contentRelease.verifyStoredItems")(
  function* (releaseId: string, afterIndex: number) {
    const { runMutation } = yield* MutationRunner;
    let cursor = afterIndex;
    while (true) {
      const page = yield* runMutation(
        refs.internal.contentRelease.verify.verifyItems,
        {
          afterIndex: cursor,
          releaseId,
        }
      ).pipe(Effect.catchTag("SchemaError", Effect.die));
      if (page.done) {
        return;
      }
      cursor = page.nextIndex;
    }
  }
);

/** Traverses the permanent route directory and validates every active owner. */
export const verifyRouteCatalog = Effect.fn(
  "contentRelease.verifyRouteCatalog"
)(function* (releaseId: string) {
  const { runQuery } = yield* QueryRunner;
  let cursor: null | string = null;
  while (true) {
    const page: RouteCatalogPage = yield* runQuery(
      refs.internal.contentRelease.proof.routes.routes,
      {
        cursor,
        releaseId,
      }
    ).pipe(Effect.catchTag("SchemaError", Effect.die));
    if (page.done) {
      return;
    }
    if (page.nextCursor === null || page.nextCursor === cursor) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Route catalog for ${releaseId} stopped advancing.`
      );
    }
    cursor = page.nextCursor;
  }
});

/** Reauthenticates one bounded artifact batch on an isolated Node worker. */
export const verifyArtifactBatchProgram = Effect.fn(
  "contentRelease.verifyArtifactProofBatch"
)(function* (manifestHash: string, releaseId: string, batchIndex: number) {
  const { runQuery } = yield* QueryRunner;
  const { renderer } = yield* loadProofIdentity(manifestHash, releaseId);
  const page = yield* runQuery(
    refs.internal.contentRelease.proof.read.artifactBatch,
    {
      batchIndex,
      releaseId,
    }
  ).pipe(Effect.catchTag("SchemaError", Effect.die));
  const verifiedArtifacts = yield* verifyArtifactBatch(
    page.rows,
    releaseId,
    renderer
  );
  return {
    batchIndex: page.batchIndex,
    verifiedArtifacts,
  };
});

/** Recomputes the complete authenticated proof before activation. */
export const recomputeProgram = Effect.fn("contentRelease.recomputeProof")(
  function* (
    manifestHash: string,
    releaseId: string,
    verifiedArtifacts: number
  ) {
    const { runMutation } = yield* MutationRunner;
    const { release, state } = yield* loadProofIdentity(
      manifestHash,
      releaseId
    );
    yield* verifyStoredItems(releaseId, state.checkedIndex);
    const evidence = yield* Effect.all(
      {
        routeCatalog: verifyRouteCatalog(releaseId),
        content: verifyContentStreams(release, readProofStream(releaseId)),
        result: verifyResultCatalog({
          expectedCount: release.manifest.resultCount,
          expectedDigest: release.manifest.resultDigest,
          heads: readResultStream(releaseId),
          releaseId: release.manifest.releaseId,
        }).pipe(Effect.mapError(contractFailure)),
        routes: verifyContentRoutes({
          manifest: release.manifest,
          routes: readRouteStream(releaseId),
        }).pipe(Effect.mapError(contractFailure)),
        snapshots: verifyReleaseSnapshots(
          release,
          state.role,
          state.stagedSnapshotBatches,
          state.stagedSnapshotRows
        ),
      },
      {
        concurrency: "unbounded",
      }
    );
    const { items, projections, rollback } = evidence.content;
    const { result, routes, snapshots } = evidence;
    const countersMatch =
      state.stagedItems === release.manifest.itemCount &&
      state.stagedItems === items.deleteCount + items.upsertCount &&
      release.manifest.deleteCount === items.deleteCount &&
      release.manifest.upsertCount === items.upsertCount &&
      state.stagedDeletes === items.deleteCount &&
      state.stagedUpserts === items.upsertCount &&
      state.stagedArtifacts === verifiedArtifacts &&
      state.stagedArtifacts === items.upsertCount &&
      state.stagedProjections === projections.count &&
      state.stagedProjections === items.upsertCount &&
      state.stagedRoutes === routes.count &&
      state.stagedRoutes === release.manifest.routeCount &&
      state.stagedSnapshotRows === snapshots.stagedRows &&
      rollback.count === release.manifest.rollbackCount &&
      result.count === release.manifest.resultCount;
    if (!countersMatch) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content release ${releaseId} counters do not match authenticated streams.`
      );
    }
    const proof: ReleaseVerificationEvidence = {
      activeAppLocales: release.manifest.activeAppLocales,
      baseActiveAppLocales: release.manifest.baseActiveAppLocales,
      baseManifestHash: release.manifest.baseManifestHash,
      baseReleaseId: release.manifest.baseReleaseId,
      baseResultCount: release.manifest.baseResultCount,
      baseResultDigest: release.manifest.baseResultDigest,
      deleteHeads: items.deleteCount,
      itemCount: release.manifest.itemCount,
      itemsDigest: release.manifest.itemsDigest,
      manifestHash: release.manifestHash,
      projectionCount: release.manifest.projectionCount,
      projectionDigest: release.manifest.projectionDigest,
      releaseId: release.manifest.releaseId,
      rendererManifestHash: release.manifest.rendererManifestHash,
      resultCount: result.count,
      resultDigest: result.digest,
      rollbackCount: rollback.count,
      rollbackDigest: rollback.digest,
      routeCount: routes.count,
      routeDigest: release.manifest.routeDigest,
      snapshots: snapshots.snapshots,
      stagedArtifacts: verifiedArtifacts,
      stagedRoutes: routes.count,
      stagedSnapshotRows: snapshots.stagedRows,
      upsertHeads: items.upsertCount,
    };
    const proofJson = yield* Schema.encodeEffect(ProofJsonSchema)(proof).pipe(
      Effect.orDie
    );
    yield* runMutation(refs.internal.contentRelease.proof.commit.commitProof, {
      proofJson,
    }).pipe(Effect.catchTag("SchemaError", Effect.die));
    return proof;
  }
);
