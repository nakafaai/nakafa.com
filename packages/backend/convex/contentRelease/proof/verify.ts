"use node";

import { verifyContentProjections } from "@nakafa/aksara-contracts/projection/verify";
import type { ReleaseVerificationEvidence } from "@nakafa/aksara-contracts/release";
import { verifyContentReleaseItems } from "@nakafa/aksara-contracts/release/items";
import { verifyResultCatalog } from "@nakafa/aksara-contracts/release/result-digest";
import { verifyRollbackSnapshot } from "@nakafa/aksara-contracts/release/rollback-digest";
import { verifyContentRoutes } from "@nakafa/aksara-contracts/release/routes";
import { verifySignedContentRelease } from "@nakafa/aksara-contracts/release/verify";
import { validateRendererManifestHash } from "@nakafa/aksara-contracts/renderer/manifest";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import {
  decodeReleaseJson,
  decodeRendererJson,
  decodeRollbackJson,
  parseStoredJson,
} from "@repo/backend/convex/contentRelease/parse";
import { verifyArtifacts } from "@repo/backend/convex/contentRelease/proof/artifacts";
import type { RouteCatalogPage } from "@repo/backend/convex/contentRelease/proof/catalog";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import type { ProofState } from "@repo/backend/convex/contentRelease/proof/read";
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
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect, Option, Stream } from "effect";

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
>("contentRelease/proof/catalog:routes");
const beginReference = makeFunctionReference<
  "mutation",
  { releaseId: string },
  number
>("contentRelease/verify:begin");
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
    yield* callInternal(() => ctx.runMutation(beginReference, { releaseId }));
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
    const itemStream = readProofStream(ctx, "item", releaseId).pipe(
      Stream.mapEffect(({ itemJson }) => parseStoredJson(itemJson))
    );
    const projectionStream = readProofStream(ctx, "item", releaseId).pipe(
      Stream.filterMap(({ projectionJson }) =>
        Option.fromNullable(projectionJson)
      ),
      Stream.mapEffect(parseStoredJson)
    );
    const rollbackStream = readProofStream(ctx, "item", releaseId).pipe(
      Stream.mapEffect(({ rollbackJson }) => decodeRollbackJson(rollbackJson))
    );
    const items = yield* verifyContentReleaseItems({
      items: itemStream,
      manifest: release.manifest,
    }).pipe(Effect.mapError(contractFailure));
    const projections = yield* verifyContentProjections({
      manifest: release.manifest,
      projections: projectionStream,
    }).pipe(Effect.mapError(contractFailure));
    const rollback = yield* verifyRollbackSnapshot({
      entries: rollbackStream,
      manifest: release.manifest,
    }).pipe(Effect.mapError(contractFailure));
    const routes = yield* verifyContentRoutes({
      manifest: release.manifest,
      routes: readRouteStream(ctx, releaseId),
    }).pipe(Effect.mapError(contractFailure));
    yield* verifyStoredItems(ctx, releaseId, state.checkedIndex);
    yield* verifyRouteCatalog(ctx, releaseId);
    const result = yield* verifyResultCatalog({
      expectedCount: release.manifest.resultCount,
      expectedDigest: release.manifest.resultDigest,
      heads: readResultStream(ctx, releaseId),
      releaseId: release.manifest.releaseId,
    }).pipe(Effect.mapError(contractFailure));
    const artifactCount = yield* verifyArtifacts(
      readProofStream(ctx, "artifact", releaseId),
      releaseId,
      renderer,
      release.manifest.rendererContractVersion
    );
    const countersMatch =
      state.stagedItems === release.manifest.itemCount &&
      state.stagedItems === items.deleteCount + items.upsertCount &&
      release.manifest.deleteCount === items.deleteCount &&
      release.manifest.upsertCount === items.upsertCount &&
      state.stagedDeletes === items.deleteCount &&
      state.stagedUpserts === items.upsertCount &&
      state.stagedArtifacts === artifactCount &&
      state.stagedArtifacts === items.upsertCount &&
      state.stagedProjections === projections.count &&
      state.stagedProjections === items.upsertCount &&
      state.stagedRoutes === routes.count &&
      state.stagedRoutes === release.manifest.routeCount &&
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
      stagedArtifacts: artifactCount,
      stagedRoutes: routes.count,
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
