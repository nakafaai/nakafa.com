import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { retireRuntimeState } from "@repo/backend/convex/contentRelease/retire/impl";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { cleanupProofValidator } from "@repo/backend/convex/tryouts/migration/cleanup/schema";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

const retirementArgsValidator = v.object({
  observationId: v.string(),
  proof: cleanupProofValidator,
  receiptJson: v.string(),
});

const retirementResultValidator = v.object({
  deleted: v.union(v.literal(0), v.literal(14)),
  deletedLegacyBundles: v.union(v.literal(0), v.literal(9)),
  migrationId: v.string(),
  observationId: v.string(),
  permanentAttempts: v.number(),
  receiptHash: v.string(),
  retiredAt: v.number(),
});
type RetirementResult = Infer<typeof retirementResultValidator>;

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

/** Removes the last audited rows after migration and predecessor contraction. */
export const retire = internalMutation({
  args: retirementArgsValidator,
  returns: retirementResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        return yield* requireProductionResult(
          yield* retireRuntimeState(
            ctx,
            args.observationId,
            args.receiptJson,
            args.proof
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
