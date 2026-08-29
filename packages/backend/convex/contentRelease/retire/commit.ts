import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { retireRuntimeState } from "@repo/backend/convex/contentRelease/retire/impl";
import {
  type RetirementResult,
  retirementCommitArgsValidator,
  retirementResultValidator,
} from "@repo/backend/convex/contentRelease/retire/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { Effect } from "effect";

const requireProductionResult = Effect.fn(
  "contentRelease.retire.requireProductionResult"
)(function* (result: {
  readonly deleted: number;
  readonly deletedLegacyBundles: number;
  readonly migrationId: string;
  readonly observationId: string;
  readonly permanentAttempts: number;
  readonly receiptHash: string;
  readonly retiredAt: number;
}) {
  if (result.deleted === 0 && result.deletedLegacyBundles === 0) {
    return {
      ...result,
      deleted: 0,
      deletedLegacyBundles: 0,
    } satisfies RetirementResult;
  }
  if (result.deleted === 14 && result.deletedLegacyBundles === 9) {
    return {
      ...result,
      deleted: 14,
      deletedLegacyBundles: 9,
    } satisfies RetirementResult;
  }
  return yield* releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    "Runtime retirement produced an unexpected production deletion count."
  );
});

/** Atomic contraction called only with a proof from the owning Node action. */
export const commit = internalMutation({
  args: retirementCommitArgsValidator,
  returns: retirementResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        return yield* requireProductionResult(
          yield* retireRuntimeState(
            ctx,
            args.observationId,
            args.receiptJson,
            args.proof,
            args.runtimeProofHash
          )
        );
      }).pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          contentKeyResolver
        )
      )
    ),
});
