import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  decodeReleaseJson,
  decodeRendererJson,
} from "@repo/backend/confect/contentRelease/parse";
import { PublicationSource } from "@repo/backend/content/publication/source";
import { Array as Arr, Effect, Option } from "effect";

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
  if (Arr.every(fields, (field) => field === undefined)) {
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
    signed.manifest.rendererManifestHash !== renderer.hash
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
            snapshots: {
              assessment:
                active.signed.manifest.snapshots.assessment.resultSnapshotId,
              program:
                active.signed.manifest.snapshots.program.resultSnapshotId,
              quran: active.signed.manifest.snapshots.quran.resultSnapshotId,
            },
          }
        : null
    )
  )
);

/**
 * The signed release document and renderer manifest of the active release, which
 * every public body of the release is verified against. A reader takes them once
 * per release instead of once per body.
 */
export const readActiveFrame = Effect.fn("contentRelease.readActiveFrame")(
  function* () {
    const active = yield* loadActiveIdentity();
    if (!active) {
      return null;
    }
    if (active.releaseId !== active.signed.manifest.releaseId) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "The active release identity is invalid."
      );
    }
    return {
      activeManifestHash: active.manifestHash,
      activeReleaseId: active.releaseId,
      releaseJson: active.release.releaseJson,
      rendererJson: active.release.rendererJson,
    };
  }
);
