import { PublicationSource } from "@repo/backend/content/publication/source";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  decodeReleaseJson,
  decodeRendererJson,
} from "@repo/backend/convex/contentRelease/parse";
import { hasRendererIdentity } from "@repo/backend/convex/contentRelease/renderer";
import { v } from "convex/values";
import { Effect, Option } from "effect";

/** Reads and validates the complete active publication snapshot identity. */
export const loadActiveIdentity = Effect.fn(
  "contentRelease.loadActiveIdentity"
)(function* () {
  const source = yield* PublicationSource;
  const state = Option.getOrNull(yield* source.state);
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
  const release = yield* source.release(state.activeReleaseId);
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
    state,
  };
});

export const activeIdentityValidator = v.union(
  v.null(),
  v.object({
    manifestHash: v.string(),
    releaseId: v.string(),
    sequence: v.number(),
  })
);

/** Projects the exact active identity for public server consumers. */
export const readActiveIdentity = Effect.fn(
  "contentRelease.readActiveIdentity"
)(() =>
  loadActiveIdentity().pipe(
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
);
