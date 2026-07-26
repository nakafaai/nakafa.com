import {
  hasSameContentSnapshots,
  invertContentSnapshots,
} from "@nakafa/aksara-contracts/release/snapshot";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadRelease,
  loadState,
} from "@repo/backend/convex/contentRelease/model";
import { scheduleReadModels } from "@repo/backend/convex/contentRelease/models";
import {
  decodeReleaseJson,
  decodeRendererJson,
} from "@repo/backend/convex/contentRelease/parse";
import {
  completedReceipt,
  publicationReceipt,
  stagedEvidence,
} from "@repo/backend/convex/contentRelease/receipt";
import { hasRendererIdentity } from "@repo/backend/convex/contentRelease/renderer";
import { publicationReceiptValidator } from "@repo/backend/convex/contentRelease/spec";
import { encodeRendererJson } from "@repo/backend/convex/contentRelease/wire";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

/** Confirms one activation request uses the frozen live renderer envelope. */
const validateRenderer = Effect.fn("contentRelease.validateActivationRenderer")(
  function* (
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
  }
);

/** Returns terminal evidence for one idempotently repeated activation. */
const completedRetry = Effect.fn("contentRelease.completedActivationRetry")(
  function* (
    ctx: MutationCtx,
    releaseId: string,
    sequence: number,
    release: Doc<"contentReleases">
  ) {
    const state = yield* loadState(ctx);
    if (
      state?.activeReleaseId !== releaseId ||
      state.activeSequence !== sequence
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Completed release ${releaseId} is not the active sequence.`
      );
    }
    const signed = yield* decodeReleaseJson(release.releaseJson);
    return yield* completedReceipt(release, signed);
  }
);

/** Atomically activates a candidate only with its verified inverse retained. */
const activateCandidate = Effect.fn("contentRelease.activateCandidate")(
  function* (
    ctx: MutationCtx,
    releaseId: string,
    rendererJson: string,
    manifestHash: string
  ) {
    const release = yield* loadRelease(ctx, releaseId);
    const signed = yield* validateRenderer(
      releaseId,
      release.releaseJson,
      release.rendererJson,
      rendererJson,
      manifestHash
    );
    if (release.status === "completed") {
      const receipt = yield* completedRetry(
        ctx,
        releaseId,
        release.sequence,
        release
      );
      yield* scheduleReadModels(ctx, releaseId);
      return receipt;
    }
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
    yield* stagedEvidence(release, signed);
    yield* stagedEvidence(recovery, recoverySigned);
    const receipt = yield* publicationReceipt(release, signed);
    const now = Date.now();
    yield* Effect.promise(() =>
      ctx.db.patch("contentReleases", release._id, {
        completedAt: now,
        receiptJson: JSON.stringify(receipt),
        status: "completed",
        updatedAt: now,
      })
    );
    yield* Effect.promise(() =>
      ctx.db.patch("contentState", state._id, {
        activeManifestHash: manifestHash,
        activeReleaseId: releaseId,
        activeSequence: release.sequence,
        candidateManifestHash: undefined,
        candidateReleaseId: undefined,
        candidateSequence: undefined,
        updatedAt: now,
      })
    );
    yield* scheduleReadModels(ctx, releaseId);
    return receipt;
  }
);

/** Atomically activates the retained inverse without restaging any rows. */
const activateRecoveryProgram = Effect.fn("contentRelease.activateRecovery")(
  function* (
    ctx: MutationCtx,
    releaseId: string,
    rendererJson: string,
    manifestHash: string
  ) {
    const release = yield* loadRelease(ctx, releaseId);
    const signed = yield* validateRenderer(
      releaseId,
      release.releaseJson,
      release.rendererJson,
      rendererJson,
      manifestHash
    );
    if (release.status === "completed") {
      const receipt = yield* completedRetry(
        ctx,
        releaseId,
        release.sequence,
        release
      );
      yield* scheduleReadModels(ctx, releaseId);
      return receipt;
    }
    const state = yield* loadState(ctx);
    if (
      !state ||
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
    yield* stagedEvidence(release, signed);
    const receipt = yield* publicationReceipt(release, signed);
    const now = Date.now();
    yield* Effect.promise(() =>
      ctx.db.patch("contentReleases", release._id, {
        completedAt: now,
        receiptJson: JSON.stringify(receipt),
        status: "completed",
        updatedAt: now,
      })
    );
    yield* Effect.promise(() =>
      ctx.db.patch("contentState", state._id, {
        activeManifestHash: manifestHash,
        activeReleaseId: releaseId,
        activeSequence: release.sequence,
        recoveryManifestHash: undefined,
        recoveryReleaseId: undefined,
        recoverySequence: undefined,
        updatedAt: now,
      })
    );
    yield* scheduleReadModels(ctx, releaseId);
    return receipt;
  }
);

/** Atomically activates one verified candidate plus retained recovery. */
export const activate = internalMutation({
  args: {
    manifestHash: v.string(),
    releaseId: v.string(),
    rendererJson: v.string(),
  },
  returns: publicationReceiptValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      activateCandidate(
        ctx,
        args.releaseId,
        args.rendererJson,
        args.manifestHash
      )
    ),
});

/** Atomically activates one previously verified retained inverse. */
export const activateRecovery = internalMutation({
  args: {
    manifestHash: v.string(),
    releaseId: v.string(),
    rendererJson: v.string(),
  },
  returns: publicationReceiptValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      activateRecoveryProgram(
        ctx,
        args.releaseId,
        args.rendererJson,
        args.manifestHash
      )
    ),
});
