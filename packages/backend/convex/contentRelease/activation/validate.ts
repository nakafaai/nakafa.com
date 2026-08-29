import {
  hasSameContentSnapshots,
  invertContentSnapshots,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadRelease,
  loadState,
} from "@repo/backend/convex/contentRelease/model";
import {
  decodeReleaseJson,
  decodeRendererJson,
} from "@repo/backend/convex/contentRelease/parse";
import { validateRecoveryRelation } from "@repo/backend/convex/contentRelease/recovery";
import { hasRendererIdentity } from "@repo/backend/convex/contentRelease/renderer";
import { encodeRendererJson } from "@repo/backend/convex/contentRelease/wire";
import { Effect } from "effect";

/** Confirms one activation request uses its frozen live renderer envelope. */
export const validateActivationRenderer = Effect.fn(
  "contentRelease.validateRenderer"
)(function* (
  releaseId: string,
  releaseJson: string,
  storedRendererJson: string,
  currentRendererJson: string,
  manifestHash: string
) {
  const signed = yield* decodeReleaseJson(releaseJson);
  if (signed.manifestHash !== manifestHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Content release ${releaseId} cannot activate another manifest.`
    );
  }
  const renderer = yield* decodeRendererJson(currentRendererJson);
  if (
    encodeRendererJson(renderer) !== storedRendererJson ||
    !hasRendererIdentity(signed.manifest, renderer)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_UNSUPPORTED",
      `Content release ${releaseId} does not match the current renderer.`
    );
  }
  return signed;
});

/** Loads and proves one verified candidate plus its retained inverse. */
export const validateCandidate = Effect.fn("contentRelease.validateCandidate")(
  function* (
    ctx: MutationCtx,
    releaseId: string,
    rendererJson: string,
    manifestHash: string
  ) {
    const release = yield* loadRelease(ctx, releaseId);
    const signed = yield* validateActivationRenderer(
      releaseId,
      release.releaseJson,
      release.rendererJson,
      rendererJson,
      manifestHash
    );
    const state = yield* loadState(ctx);
    if (
      !state ||
      release.role !== "candidate" ||
      release.status !== "verified" ||
      state.candidateReleaseId !== releaseId ||
      state.candidateManifestHash !== manifestHash ||
      state.candidateSequence !== release.sequence ||
      !state.recoveryReleaseId ||
      !state.recoveryManifestHash ||
      state.recoverySequence === undefined
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Content release ${releaseId} lacks a verified retained recovery.`
      );
    }
    if (
      (state.activeReleaseId ?? null) !== signed.manifest.baseReleaseId ||
      (state.activeManifestHash ?? null) !== signed.manifest.baseManifestHash
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STALE_BASE",
        `Content release ${releaseId} no longer extends the active release.`
      );
    }
    const recovery = yield* loadRelease(ctx, state.recoveryReleaseId);
    const recoverySigned = yield* decodeReleaseJson(recovery.releaseJson);
    if (
      recovery.role !== "recovery" ||
      recovery.status !== "verified" ||
      recovery.sequence !== state.recoverySequence ||
      recoverySigned.manifestHash !== state.recoveryManifestHash ||
      recoverySigned.manifest.baseReleaseId !== releaseId ||
      recoverySigned.manifest.baseManifestHash !== manifestHash ||
      recoverySigned.manifest.resultCount !== signed.manifest.baseResultCount ||
      recoverySigned.manifest.resultDigest !==
        signed.manifest.baseResultDigest ||
      !hasSameContentSnapshots(
        recoverySigned.manifest.snapshots,
        invertContentSnapshots(signed.manifest.snapshots)
      )
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Recovery ${recovery.releaseId} does not invert candidate ${releaseId}.`
      );
    }
    return { recovery, recoverySigned, release, signed, state };
  }
);

/** Loads and proves the exact retained recovery against current production. */
export const validateRecovery = Effect.fn(
  "contentRelease.validateRecoveryActivation"
)(function* (
  ctx: MutationCtx,
  releaseId: string,
  rendererJson: string,
  manifestHash: string
) {
  const release = yield* loadRelease(ctx, releaseId);
  const signed = yield* validateActivationRenderer(
    releaseId,
    release.releaseJson,
    release.rendererJson,
    rendererJson,
    manifestHash
  );
  const state = yield* loadState(ctx);
  if (
    !state ||
    release.role !== "recovery" ||
    release.status !== "verified" ||
    state.candidateReleaseId !== undefined ||
    !state.activeReleaseId ||
    state.recoveryReleaseId !== releaseId ||
    state.recoveryManifestHash !== manifestHash ||
    state.recoverySequence !== release.sequence ||
    state.activeReleaseId !== signed.manifest.baseReleaseId ||
    state.activeManifestHash !== signed.manifest.baseManifestHash
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Recovery ${releaseId} is not the exact retained inverse.`
    );
  }
  const active = yield* loadRelease(ctx, state.activeReleaseId);
  yield* validateRecoveryRelation(active, release);
  return { release, signed, state };
});
