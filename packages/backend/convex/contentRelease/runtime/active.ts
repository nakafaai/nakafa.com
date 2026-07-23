import { type QueryCtx, query } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadRelease,
  loadState,
} from "@repo/backend/convex/contentRelease/model";
import {
  decodeReleaseJson,
  decodeRendererJson,
} from "@repo/backend/convex/contentRelease/parse";
import { hasRendererIdentity } from "@repo/backend/convex/contentRelease/renderer";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

const activeIdentityValidator = v.union(
  v.null(),
  v.object({
    manifestHash: v.string(),
    releaseId: v.string(),
    sequence: v.number(),
  })
);

/** Reads and validates the complete active publication snapshot identity. */
export const loadActiveIdentity = Effect.fn(
  "contentRelease.loadActiveIdentity"
)(function* (ctx: QueryCtx) {
  const state = yield* loadState(ctx);
  const fields = [
    state?.activeManifestHash,
    state?.activeReleaseId,
    state?.activeSequence,
  ];
  if (fields.every((field) => field === undefined)) {
    return null;
  }
  if (
    !(state?.activeManifestHash && state.activeReleaseId) ||
    state.activeSequence === undefined
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Active content state has a partial sequence identity."
    );
  }
  const release = yield* loadRelease(ctx, state.activeReleaseId);
  const signed = yield* decodeReleaseJson(release.releaseJson);
  const renderer = yield* decodeRendererJson(release.rendererJson);
  if (
    release.status !== "completed" ||
    release.sequence !== state.activeSequence ||
    signed.manifestHash !== state.activeManifestHash ||
    !hasRendererIdentity(signed.manifest, renderer)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Active content release lost its runtime identity."
    );
  }

  return {
    manifestHash: state.activeManifestHash,
    release,
    renderer,
    releaseId: state.activeReleaseId,
    sequence: state.activeSequence,
    signed,
  };
});

/** Returns the exact active release identity after full integrity validation. */
export const read = query({
  args: {},
  returns: activeIdentityValidator,
  handler: (ctx) =>
    runConvexProgram(
      loadActiveIdentity(ctx).pipe(
        Effect.map((active) =>
          active
            ? {
                manifestHash: active.manifestHash,
                releaseId: active.releaseId,
                sequence: active.sequence,
              }
            : null
        )
      )
    ),
});
