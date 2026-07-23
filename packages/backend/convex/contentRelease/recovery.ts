import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadRelease } from "@repo/backend/convex/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import { completedReceipt } from "@repo/backend/convex/contentRelease/receipt";
import { publicationReceiptValidator } from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

/** Exact stored recovery result returned to the authenticated Node verifier. */
export const recoveryLookupValidator = v.union(
  v.object({ kind: v.literal("missing") }),
  v.object({
    kind: v.literal("completed"),
    value: v.object({
      receipt: publicationReceiptValidator,
      releaseJson: v.string(),
      rendererJson: v.string(),
    }),
  })
);

/** Proves one recovery manifest is the exact inverse of its candidate. */
export const validateRecoveryRelation = Effect.fn(
  "contentRelease.validateRecoveryRelation"
)(function* (
  candidate: Doc<"contentReleases">,
  recovery: Doc<"contentReleases">
) {
  const candidateSigned = yield* decodeReleaseJson(candidate.releaseJson);
  const recoverySigned = yield* decodeReleaseJson(recovery.releaseJson);
  if (
    candidate.role !== "candidate" ||
    candidate.status !== "completed" ||
    recovery.role !== "recovery" ||
    recoverySigned.manifest.origin.kind !== "rollback" ||
    recoverySigned.manifest.origin.releaseId !== candidate.releaseId ||
    recoverySigned.manifest.baseReleaseId !== candidate.releaseId ||
    recoverySigned.manifest.baseManifestHash !== candidateSigned.manifestHash ||
    recoverySigned.manifest.baseResultCount !==
      candidateSigned.manifest.resultCount ||
    recoverySigned.manifest.baseResultDigest !==
      candidateSigned.manifest.resultDigest ||
    recoverySigned.manifest.resultCount !==
      candidateSigned.manifest.baseResultCount ||
    recoverySigned.manifest.resultDigest !==
      candidateSigned.manifest.baseResultDigest
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Recovery ${recovery.releaseId} is not the exact inverse of candidate ${candidate.releaseId}.`
    );
  }
  yield* completedReceipt(candidate, candidateSigned);
  return { candidate: candidateSigned, recovery: recoverySigned };
});

/** Looks up exact historical recovery completion for crash-safe replay. */
export const lookupProgram = Effect.fn("contentRelease.recoveryLookup")(
  function* (ctx: QueryCtx, releaseId: string, recoveryId: string) {
    const recovery = yield* Effect.promise(() =>
      ctx.db
        .query("contentReleases")
        .withIndex("by_releaseId", (query) => query.eq("releaseId", recoveryId))
        .unique()
    );
    if (recovery?.status !== "completed") {
      return { kind: "missing" } satisfies { readonly kind: "missing" };
    }
    const candidate = yield* loadRelease(ctx, releaseId);
    const signed = yield* validateRecoveryRelation(candidate, recovery);
    return {
      kind: "completed",
      value: {
        receipt: yield* completedReceipt(recovery, signed.recovery),
        releaseJson: recovery.releaseJson,
        rendererJson: recovery.rendererJson,
      },
    } satisfies {
      readonly kind: "completed";
      readonly value: {
        readonly receipt: unknown;
        readonly releaseJson: string;
        readonly rendererJson: string;
      };
    };
  }
);

/** Internal read used only by the authenticated historical recovery lookup. */
export const lookup = internalQuery({
  args: { recoveryId: v.string(), releaseId: v.string() },
  returns: recoveryLookupValidator,
  handler: (ctx, args) =>
    runConvexProgram(lookupProgram(ctx, args.releaseId, args.recoveryId)),
});
