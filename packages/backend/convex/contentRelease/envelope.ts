import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadRelease } from "@repo/backend/convex/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

const envelopeValidator = v.object({
  releaseJson: v.string(),
  rendererJson: v.string(),
});

/** Reads stored authenticated envelopes only for one exact manifest identity. */
const envelopeProgram = Effect.fn("contentRelease.envelope")(function* (
  ctx: QueryCtx,
  releaseId: string,
  manifestHash: string
) {
  const release = yield* loadRelease(ctx, releaseId);
  const signed = yield* decodeReleaseJson(release.releaseJson);
  if (signed.manifestHash !== manifestHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Content release ${releaseId} does not own manifest ${manifestHash}.`
    );
  }
  return {
    releaseJson: release.releaseJson,
    rendererJson: release.rendererJson,
  };
});

/** Returns frozen release evidence for authenticated lifecycle operations. */
export const get = internalQuery({
  args: { manifestHash: v.string(), releaseId: v.string() },
  returns: envelopeValidator,
  handler: (ctx, args) =>
    runConvexProgram(envelopeProgram(ctx, args.releaseId, args.manifestHash)),
});

/** Returns stored bundle bytes for Node-side verification by release identity. */
export const byRelease = internalQuery({
  args: { releaseId: v.string() },
  returns: envelopeValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      loadRelease(ctx, args.releaseId).pipe(
        Effect.map((release) => ({
          releaseJson: release.releaseJson,
          rendererJson: release.rendererJson,
        }))
      )
    ),
});
