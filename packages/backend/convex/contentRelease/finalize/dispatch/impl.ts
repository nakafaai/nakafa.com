"use node";

import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { verifySignedTryoutRuntimeBundle } from "@nakafa/aksara-contracts/tryout/runtime/verify";
import {
  activeContentSigningKeyId,
  contentKeyResolver,
} from "@repo/backend/content/trust";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import {
  type ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import {
  type FinalizationBackfillArgs,
  type FinalizationContract,
  type FinalizationReceipt,
  type FinalizationSource,
  type FinalizationTargetSource,
  finalizationContract,
} from "@repo/backend/convex/contentRelease/finalize/spec";
import {
  hashFinalizationTargets,
  selectFinalizationTargetHashes,
} from "@repo/backend/convex/contentRelease/finalize/targets";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { requireActiveContentKey } from "@repo/backend/convex/contentRelease/ingress/key";
import {
  decodeRendererJson,
  decodeTryoutRuntimeBundleJson,
} from "@repo/backend/convex/contentRelease/parse";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import {
  encodeRendererJson,
  encodeTryoutRuntimeBundleJson,
} from "@repo/backend/convex/contentRelease/wire";
import { makeFunctionReference } from "convex/server";
import { Effect } from "effect";

export interface FinalizationGateway {
  readonly backfill: (
    args: FinalizationBackfillArgs
  ) => Effect.Effect<FinalizationReceipt, ReleaseError>;
  readonly loadSource: Effect.Effect<FinalizationSource, ReleaseError>;
}

export interface FinalizationDispatchContract {
  readonly activeKeyId: string;
  readonly finalization: Pick<
    FinalizationContract,
    "attempts" | "genesisBundleHash"
  >;
}

const productionDispatchContract = {
  activeKeyId: activeContentSigningKeyId,
  finalization: finalizationContract,
} satisfies FinalizationDispatchContract;

const sourceReference = makeFunctionReference<
  "query",
  Record<string, never>,
  FinalizationSource
>("contentRelease/finalize/source:source");
const backfillReference = makeFunctionReference<
  "mutation",
  FinalizationBackfillArgs,
  FinalizationReceipt
>("contentRelease/finalize/backfill:backfill");

/** Binds the Node action to its exact internal read and write capabilities. */
function makeFinalizationGateway(
  ctx: Pick<ActionCtx, "runMutation" | "runQuery">
): FinalizationGateway {
  return {
    backfill: (args) =>
      callInternal(() => ctx.runMutation(backfillReference, args)),
    loadSource: callInternal(() => ctx.runQuery(sourceReference, {})),
  };
}

/** Cryptographically authenticates one complete stored target row. */
const authenticateTarget = Effect.fn(
  "contentRelease.finalize.authenticateTarget"
)(function* (source: FinalizationTargetSource) {
  const [decodedBundle, renderer] = yield* Effect.all([
    decodeTryoutRuntimeBundleJson(source.bundleJson),
    decodeRendererJson(source.rendererJson),
  ]);
  const bundle = yield* verifySignedTryoutRuntimeBundle({
    bundle: decodedBundle,
    rendererManifest: renderer,
  }).pipe(Effect.mapError(contractFailure));
  if (
    source.bundleJson !== encodeTryoutRuntimeBundleJson(bundle) ||
    source.rendererJson !== encodeRendererJson(renderer) ||
    source.bundleHash !== bundle.bundleHash ||
    source.snapshotId !== bundle.payload.snapshot.snapshotId ||
    source.rendererManifestHash !== bundle.payload.rendererManifestHash ||
    source.rendererManifestHash !== renderer.hash ||
    source.sourceGitSha !== bundle.payload.sourceGitSha ||
    source.sourceManifestHash !== bundle.payload.sourceManifestHash ||
    source.sourceReleaseId !== bundle.payload.sourceReleaseId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Terminal try-out expansion found an unauthenticated target identity."
    );
  }
  return bundle.bundleHash;
});

/** Requires exact equality with the targets derived from the contract. */
const authenticateTargets = Effect.fn(
  "contentRelease.finalize.authenticateTargets"
)(function* (
  sources: readonly FinalizationTargetSource[],
  contract: Pick<FinalizationContract, "attempts" | "genesisBundleHash">
) {
  const expected = selectFinalizationTargetHashes(contract);
  const authenticated = (yield* Effect.forEach(
    sources,
    authenticateTarget
  )).sort();
  if (
    authenticated.length !== expected.length ||
    new Set(authenticated).size !== authenticated.length ||
    authenticated.some((bundleHash, index) => bundleHash !== expected[index])
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Terminal try-out expansion authenticated a different target set."
    );
  }
  return yield* hashFinalizationTargets(sources);
});

/** Verifies every signed asset before entering the one atomic transaction. */
export const dispatchFinalization = Effect.fn(
  "contentRelease.finalize.dispatch"
)(function* (
  gateway: FinalizationGateway,
  bundleJson: string,
  contract: FinalizationDispatchContract = productionDispatchContract
) {
  const source = yield* gateway.loadSource;
  const [decodedBundle, renderer] = yield* Effect.all([
    decodeTryoutRuntimeBundleJson(bundleJson),
    decodeRendererJson(source.rendererJson),
  ]);
  const bundle = yield* verifySignedTryoutRuntimeBundle({
    bundle: decodedBundle,
    rendererManifest: renderer,
  }).pipe(Effect.mapError(contractFailure));
  yield* requireActiveContentKey(
    bundle.keyId,
    contract.activeKeyId,
    `Genesis runtime bundle ${bundle.bundleHash}`
  );
  if (
    bundle.bundleHash !== contract.finalization.genesisBundleHash ||
    source.rendererManifestHash !== renderer.hash
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Genesis runtime asset identity changed before finalization."
    );
  }
  return yield* gateway.backfill({
    bundleJson: encodeTryoutRuntimeBundleJson(bundle),
    rendererJson: encodeRendererJson(renderer),
    targetProofHash: yield* authenticateTargets(
      source.targets,
      contract.finalization
    ),
  });
});

/** Complete Node action program supplied to the route registration boundary. */
export const makeFinalizationProgram = Effect.fn(
  "contentRelease.finalize.action"
)((ctx: ActionCtx, bundleJson: string) =>
  dispatchFinalization(makeFinalizationGateway(ctx), bundleJson).pipe(
    Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver)
  )
);
