"use node";

import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { verifySignedTryoutRuntimeBundle } from "@nakafa/aksara-contracts/tryout/runtime/verify";
import { contentKeyResolver } from "@repo/backend/content/trust";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { internalAction } from "@repo/backend/convex/_generated/server";
import {
  type ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import {
  decodeRendererJson,
  decodeTryoutRuntimeBundleJson,
} from "@repo/backend/convex/contentRelease/parse";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import {
  type RetirementArgs,
  type RetirementBundleProof,
  type RetirementBundleSource,
  type RetirementInventory,
  type RetirementResult,
  retirementArgsValidator,
  retirementResultValidator,
} from "@repo/backend/convex/contentRelease/retire/spec";
import { runConvexActionProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import { Effect } from "effect";

export interface RetirementGateway {
  readonly commit: (
    args: RetirementArgs & { readonly runtimeProofHash: string }
  ) => Effect.Effect<RetirementResult, ReleaseError>;
  readonly loadBundle: (
    args: RetirementBundleProof
  ) => Effect.Effect<RetirementBundleSource, ReleaseError>;
  readonly loadInventory: Effect.Effect<RetirementInventory, ReleaseError>;
}

const inventoryReference = makeFunctionReference<
  "query",
  Record<string, never>,
  RetirementInventory
>("contentRelease/retire/source:inventory");
const bundleReference = makeFunctionReference<
  "query",
  {
    bundleHash: string;
    bundleJsonHash: string;
    rendererJsonHash: string;
  },
  RetirementBundleSource
>("contentRelease/retire/source:bundle");
const commitReference = makeFunctionReference<
  "mutation",
  RetirementArgs & { runtimeProofHash: string },
  RetirementResult
>("contentRelease/retire/commit:commit");

/** Binds terminal retirement to its exact internal read and write capabilities. */
function makeRetirementGateway(ctx: ActionCtx): RetirementGateway {
  return {
    commit: (args) =>
      callInternal(() => ctx.runMutation(commitReference, args)),
    loadBundle: (args) =>
      callInternal(() => ctx.runQuery(bundleReference, args)),
    loadInventory: callInternal(() => ctx.runQuery(inventoryReference, {})),
  };
}

/** Authenticates every distinct permanent bundle before one atomic contraction. */
export const dispatchRetirement = Effect.fn("contentRelease.retire.dispatch")(
  function* (gateway: RetirementGateway, args: RetirementArgs) {
    const inventory = yield* gateway.loadInventory;
    yield* Effect.forEach(inventory.bundles, (expected) =>
      Effect.gen(function* () {
        const source = yield* gateway.loadBundle(expected);
        const [bundle, renderer] = yield* Effect.all([
          decodeTryoutRuntimeBundleJson(source.bundleJson),
          decodeRendererJson(source.rendererJson),
        ]);
        const verified = yield* verifySignedTryoutRuntimeBundle({
          bundle,
          rendererManifest: renderer,
        }).pipe(Effect.mapError(contractFailure));
        if (verified.bundleHash !== expected.bundleHash) {
          return yield* releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            "Runtime retirement authenticated a different permanent bundle."
          );
        }
      })
    );
    return yield* gateway.commit({
      ...args,
      runtimeProofHash: inventory.hash,
    });
  }
);

/** Node boundary for signed runtime authentication before terminal deletion. */
export const retire = internalAction({
  args: retirementArgsValidator,
  returns: retirementResultValidator,
  handler: (ctx, args) =>
    runConvexActionProgram(
      dispatchRetirement(makeRetirementGateway(ctx), args).pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          contentKeyResolver
        )
      )
    ),
});
