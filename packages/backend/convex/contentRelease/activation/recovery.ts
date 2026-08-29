import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { completedActivation } from "@repo/backend/convex/contentRelease/activation/complete";
import {
  modelActivationFields,
  requireReadyModelBuild,
} from "@repo/backend/convex/contentRelease/activation/model";
import type {
  ActivationResult,
  PreparationResult,
} from "@repo/backend/convex/contentRelease/activation/spec";
import {
  validateActivationRenderer,
  validateRecovery,
} from "@repo/backend/convex/contentRelease/activation/validate";
import { loadRelease } from "@repo/backend/convex/contentRelease/model";
import { ensureModelBuild } from "@repo/backend/convex/contentRelease/models/build";
import {
  publicationReceipt,
  stagedEvidence,
} from "@repo/backend/convex/contentRelease/receipt";
import { loadReleaseTryoutRuntime } from "@repo/backend/convex/contentRelease/tryout/runtime";
import { Clock, Effect } from "effect";

/** Starts the inactive read-model build for one retained recovery. */
export const prepareRecovery = Effect.fn("contentRelease.prepareRecovery")(
  function* (
    ctx: MutationCtx,
    releaseId: string,
    rendererJson: string,
    manifestHash: string
  ) {
    const stored = yield* loadRelease(ctx, releaseId);
    yield* validateActivationRenderer(
      releaseId,
      stored.releaseJson,
      stored.rendererJson,
      rendererJson,
      manifestHash
    );
    if (stored.status === "completed") {
      yield* completedActivation(ctx, releaseId, stored);
      return { kind: "completed" } satisfies PreparationResult;
    }
    const { release, signed, state } = yield* validateRecovery(
      ctx,
      releaseId,
      rendererJson,
      manifestHash
    );
    yield* stagedEvidence(release, signed);
    yield* ensureModelBuild(ctx, release, signed, state);
    return { kind: "prepared" } satisfies PreparationResult;
  }
);

/** Atomically publishes one ready recovery and its model buffer pointers. */
export const activateRecovery = Effect.fn("contentRelease.activateRecovery")(
  function* (
    ctx: MutationCtx,
    releaseId: string,
    rendererJson: string,
    manifestHash: string
  ) {
    const stored = yield* loadRelease(ctx, releaseId);
    yield* validateActivationRenderer(
      releaseId,
      stored.releaseJson,
      stored.rendererJson,
      rendererJson,
      manifestHash
    );
    if (stored.status === "completed") {
      return {
        kind: "completed",
        receipt: yield* completedActivation(ctx, releaseId, stored),
      } satisfies ActivationResult;
    }
    const { release, signed, state } = yield* validateRecovery(
      ctx,
      releaseId,
      rendererJson,
      manifestHash
    );
    yield* stagedEvidence(release, signed);
    const build = yield* requireReadyModelBuild(ctx, release, signed);
    const [runtime, receipt] = yield* Effect.all([
      loadReleaseTryoutRuntime(ctx, signed),
      publicationReceipt(release, signed),
    ]);
    const now = yield* Clock.currentTimeMillis;
    yield* Effect.promise(() =>
      ctx.db.patch("contentReleases", release._id, {
        completedAt: now,
        receiptJson: JSON.stringify(receipt),
        status: "completed",
        tryoutRuntimeBundleHash: runtime.result?.bundle.bundleHash,
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
        ...modelActivationFields(build, release, signed),
        updatedAt: now,
      })
    );
    yield* Effect.promise(() => ctx.db.delete("contentModelBuilds", build._id));
    return { kind: "activated", receipt } satisfies ActivationResult;
  }
);
