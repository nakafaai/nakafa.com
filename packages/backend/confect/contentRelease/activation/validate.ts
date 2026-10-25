import {
  hasSameContentSnapshots,
  invertContentSnapshots,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  isBootstrapCandidate,
  requireCurrentBase,
  requireRollbackable,
} from "@repo/backend/confect/contentRelease/generation";
import {
  loadRelease,
  loadState,
} from "@repo/backend/confect/contentRelease/model";
import {
  decodeReleaseJson,
  decodeRendererJson,
} from "@repo/backend/confect/contentRelease/parse";
import { validateRecoveryRelation } from "@repo/backend/confect/contentRelease/recovery";
import { encodeRendererJson } from "@repo/backend/confect/contentRelease/wire";
import { Effect, Option } from "effect";

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
    signed.manifest.rendererManifestHash !== renderer.hash
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_UNSUPPORTED",
      `Content release ${releaseId} does not match the current renderer.`
    );
  }
  return signed;
});

/**
 * Loads and proves one verified candidate and the inverse that activation
 * needs. A stored bootstrap is re-proven against the live state and carries no
 * inverse; every other candidate keeps the retained recovery rules, and may not
 * extend the retired generation at all.
 */
export const validateCandidate = Effect.fn("contentRelease.validateCandidate")(
  function* (releaseId: string, rendererJson: string, manifestHash: string) {
    const release = yield* loadRelease(releaseId);
    const signed = yield* validateActivationRenderer(
      releaseId,
      release.releaseJson,
      release.rendererJson,
      rendererJson,
      manifestHash
    );
    const state = yield* loadState();
    if (
      !state ||
      release.role !== "candidate" ||
      release.status !== "verified" ||
      state.candidateReleaseId !== releaseId ||
      state.candidateManifestHash !== manifestHash ||
      state.candidateSequence !== release.sequence
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Content release ${releaseId} is not the verified candidate.`
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
    if (release.bootstrap === true) {
      if (!isBootstrapCandidate(signed.manifest, state)) {
        return yield* releaseFail(
          "CONTENT_RELEASE_STATE",
          `Content release ${releaseId} no longer meets the bootstrap contract.`
        );
      }
      return {
        inverse: Option.none(),
        release,
        signed,
        state,
      };
    }
    if (
      !(state.recoveryReleaseId && state.recoveryManifestHash) ||
      state.recoverySequence === undefined
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Content release ${releaseId} lacks a verified retained recovery.`
      );
    }
    const recovery = yield* loadRelease(state.recoveryReleaseId);
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
    yield* requireCurrentBase(releaseId, state);
    return {
      inverse: Option.some({ recovery, recoverySigned }),
      release,
      signed,
      state,
    };
  }
);

/** Loads and proves the exact retained recovery against current production. */
export const validateRecovery = Effect.fn(
  "contentRelease.validateRecoveryActivation"
)(function* (releaseId: string, rendererJson: string, manifestHash: string) {
  const release = yield* loadRelease(releaseId);
  const signed = yield* validateActivationRenderer(
    releaseId,
    release.releaseJson,
    release.rendererJson,
    rendererJson,
    manifestHash
  );
  const state = yield* loadState();
  const active = state?.activeReleaseId
    ? yield* loadRelease(state.activeReleaseId)
    : undefined;
  if (active) {
    yield* requireRollbackable(active);
  }
  if (
    !(state && active) ||
    release.role !== "recovery" ||
    release.status !== "verified" ||
    state.candidateReleaseId !== undefined ||
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
  yield* validateRecoveryRelation(active, release);
  return {
    release,
    signed,
    state,
  };
});
