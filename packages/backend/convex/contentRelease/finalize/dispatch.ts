"use node";

import type { Sha256Hash } from "@nakafa/aksara-contracts/ids";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { verifySignedTryoutRuntimeBundle } from "@nakafa/aksara-contracts/tryout/runtime/verify";
import {
  activeContentSigningKeyId,
  contentKeyResolver,
} from "@repo/backend/content/trust";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { internalAction } from "@repo/backend/convex/_generated/server";
import {
  type ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { finalizationReceiptValidator } from "@repo/backend/convex/contentRelease/finalize/backfill";
import { GENESIS_BUNDLE_HASH } from "@repo/backend/convex/contentRelease/finalize/spec";
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
import { runConvexActionProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { Effect } from "effect";

type FinalizationReceipt = Infer<typeof finalizationReceiptValidator>;
interface FinalizationSource {
  readonly rendererJson: string;
  readonly rendererManifestHash: string;
}

export interface FinalizationGateway {
  readonly backfill: (args: {
    readonly bundleJson: string;
    readonly rendererJson: string;
  }) => Effect.Effect<FinalizationReceipt, ReleaseError>;
  readonly loadSource: Effect.Effect<FinalizationSource, ReleaseError>;
}

export interface FinalizationDispatchContract {
  readonly activeKeyId: string;
  readonly bundleHash: Sha256Hash;
}

const productionDispatchContract = {
  activeKeyId: activeContentSigningKeyId,
  bundleHash: GENESIS_BUNDLE_HASH,
} satisfies FinalizationDispatchContract;

const sourceReference = makeFunctionReference<
  "query",
  Record<string, never>,
  { rendererJson: string; rendererManifestHash: string }
>("contentRelease/finalize/source:source");
const backfillReference = makeFunctionReference<
  "mutation",
  { bundleJson: string; rendererJson: string },
  FinalizationReceipt
>("contentRelease/finalize/backfill:backfill");

/** Binds the action to its two internal Convex capabilities. */
function makeFinalizationGateway(
  ctx: Pick<ActionCtx, "runMutation" | "runQuery">
): FinalizationGateway {
  return {
    backfill: (args) =>
      callInternal(() => ctx.runMutation(backfillReference, args)),
    loadSource: callInternal(() => ctx.runQuery(sourceReference, {})),
  };
}

/** Verifies the immutable asset before entering the one atomic transaction. */
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
    bundle.bundleHash !== contract.bundleHash ||
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
  });
});

/** Node-authenticated boundary for the exact protected genesis asset. */
export const finalize = internalAction({
  args: { bundleJson: v.string() },
  returns: finalizationReceiptValidator,
  handler: (ctx, args) =>
    runConvexActionProgram(
      dispatchFinalization(makeFinalizationGateway(ctx), args.bundleJson).pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          contentKeyResolver
        )
      )
    ),
});
