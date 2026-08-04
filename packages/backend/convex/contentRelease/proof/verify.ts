"use node";

import type { ReleaseVerificationEvidence } from "@nakafa/aksara-contracts/release";
import { verifyResultCatalog } from "@nakafa/aksara-contracts/release/result/digest";
import { verifyContentRoutes } from "@nakafa/aksara-contracts/release/route/verify";
import { verifySignedContentRelease } from "@nakafa/aksara-contracts/release/verify";
import { validateRendererManifestHash } from "@nakafa/aksara-contracts/renderer/manifest";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { internalAction } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import {
  decodeReleaseJson,
  decodeRendererJson,
} from "@repo/backend/convex/contentRelease/parse";
import { verifyContentStreams } from "@repo/backend/convex/contentRelease/proof/content";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import type { ProofState } from "@repo/backend/convex/contentRelease/proof/read";
import type { RouteCatalogPage } from "@repo/backend/convex/contentRelease/proof/routes";
import { verifyReleaseSnapshots } from "@repo/backend/convex/contentRelease/proof/snapshot";
import {
  readProofStream,
  readResultStream,
  readRouteStream,
} from "@repo/backend/convex/contentRelease/proof/stream";
import { hasRendererIdentity } from "@repo/backend/convex/contentRelease/renderer";
import type {
  progressValidator,
  statusValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

type Progress = Infer<typeof progressValidator>;
type Status = Infer<typeof statusValidator>;

const verifyItemsReference = makeFunctionReference<
  "mutation",
  { afterIndex: number; releaseId: string },
  Progress
>("contentRelease/verify:verifyItems");
const catalogRoutesReference = makeFunctionReference<
  "query",
  { cursor: null | string; releaseId: string },
  RouteCatalogPage
>("contentRelease/proof/routes:routes");
const proofStateReference = makeFunctionReference<
  "query",
  { manifestHash: string; releaseId: string },
  ProofState
>("contentRelease/proof/read:state");
const commitProofReference = makeFunctionReference<
  "mutation",
  { proofJson: string },
  Status
>("contentRelease/proof/commit:commitProof");

/** Advances exact item verification from the durable server cursor. */
const verifyStoredItems = Effect.fn("contentRelease.verifyStoredItems")(
  function* (ctx: ActionCtx, releaseId: string, afterIndex: number) {
    let cursor = afterIndex;
    while (true) {
      const page = yield* callInternal(() =>
        ctx.runMutation(verifyItemsReference, {
          afterIndex: cursor,
          releaseId,
        })
      );
      if (page.done) {
        return;
      }
      cursor = page.nextIndex;
    }
  }
);

/** Traverses the permanent route directory and validates every active owner. */
const verifyRouteCatalog = Effect.fn("contentRelease.verifyRouteCatalog")(
  function* (ctx: ActionCtx, releaseId: string) {
    let cursor: null | string = null;
    while (true) {
      const page: RouteCatalogPage = yield* callInternal(() =>
        ctx.runQuery(catalogRoutesReference, {
          cursor,
          releaseId,
        })
      );
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
  }
);

/** Recomputes the complete authenticated proof before activation. */
export const recomputeProgram = Effect.fn("contentRelease.recomputeProof")(
  function* (ctx: ActionCtx, manifestHash: string, releaseId: string) {
    const state = yield* callInternal(() =>
      ctx.runQuery(proofStateReference, {
        manifestHash,
        releaseId,
      })
    );
    const storedRelease = yield* decodeReleaseJson(state.releaseJson);
    const release = yield* verifySignedContentRelease(storedRelease).pipe(
      Effect.mapError(contractFailure)
    );
    const storedRenderer = yield* decodeRendererJson(state.rendererJson);
    const renderer = yield* validateRendererManifestHash(storedRenderer).pipe(
      Effect.mapError(contractFailure)
    );
    if (!hasRendererIdentity(release.manifest, renderer)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_UNSUPPORTED",
        `Content release ${releaseId} no longer matches its frozen renderer.`
      );
    }
    yield* verifyStoredItems(ctx, releaseId, state.checkedIndex);
    const evidence = yield* Effect.all(
      {
        routeCatalog: verifyRouteCatalog(ctx, releaseId),
        content: verifyContentStreams(
          release,
          renderer,
          readProofStream(ctx, releaseId)
        ),
        result: verifyResultCatalog({
          expectedCount: release.manifest.resultCount,
          expectedDigest: release.manifest.resultDigest,
          heads: readResultStream(ctx, releaseId),
          releaseId: release.manifest.releaseId,
        }).pipe(Effect.mapError(contractFailure)),
        routes: verifyContentRoutes({
          manifest: release.manifest,
          routes: readRouteStream(ctx, releaseId),
        }).pipe(Effect.mapError(contractFailure)),
        snapshots: verifyReleaseSnapshots(
          ctx,
          release,
          state.role,
          state.stagedSnapshotBatches,
          state.stagedSnapshotRows
        ),
      },
      { concurrency: "unbounded" }
    );
    const { artifacts, items, projections, rollback } = evidence.content;
    const { result, routes, snapshots } = evidence;
    const countersMatch =
      state.stagedItems === release.manifest.itemCount &&
      state.stagedItems === items.deleteCount + items.upsertCount &&
      release.manifest.deleteCount === items.deleteCount &&
      release.manifest.upsertCount === items.upsertCount &&
      state.stagedDeletes === items.deleteCount &&
      state.stagedUpserts === items.upsertCount &&
      state.stagedArtifacts === artifacts &&
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
      rendererContractVersion: release.manifest.rendererContractVersion,
      rendererManifestHash: release.manifest.rendererManifestHash,
      resultCount: result.count,
      resultDigest: result.digest,
      rollbackCount: rollback.count,
      rollbackDigest: rollback.digest,
      routeCount: routes.count,
      routeDigest: release.manifest.routeDigest,
      snapshots: snapshots.snapshots,
      stagedArtifacts: artifacts,
      stagedRoutes: routes.count,
      stagedSnapshotRows: snapshots.stagedRows,
      upsertHeads: items.upsertCount,
    };
    yield* callInternal(() =>
      ctx.runMutation(commitProofReference, {
        proofJson: JSON.stringify(proof),
      })
    );
    return proof;
  }
);

/** Recomputes and commits one complete proof outside the request lifecycle. */
export const verifyRelease = internalAction({
  args: {
    manifestHash: v.string(),
    releaseId: v.string(),
  },
  returns: v.null(),
  handler: (ctx, args) =>
    runConvexProgram(
      recomputeProgram(ctx, args.manifestHash, args.releaseId).pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          contentKeyResolver
        ),
        Effect.as(null)
      )
    ),
});
