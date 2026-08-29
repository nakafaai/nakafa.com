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
  validateCandidate,
} from "@repo/backend/convex/contentRelease/activation/validate";
import { loadRelease } from "@repo/backend/convex/contentRelease/model";
import { ensureModelBuild } from "@repo/backend/convex/contentRelease/models/build";
import {
  publicationReceipt,
  stagedEvidence,
} from "@repo/backend/convex/contentRelease/receipt";
import { loadReleaseTryoutRuntime } from "@repo/backend/convex/contentRelease/tryout/runtime";
import { Clock, Effect } from "effect";

/** Starts the invisible read-model build after full candidate validation. */
export const prepareCandidate = Effect.fn("contentRelease.prepareCandidate")(
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
    const { recovery, recoverySigned, release, signed, state } =
      yield* validateCandidate(ctx, releaseId, rendererJson, manifestHash);
    yield* Effect.all([
      stagedEvidence(release, signed),
      stagedEvidence(recovery, recoverySigned),
    ]);
    yield* ensureModelBuild(ctx, release, signed, state);
    return { kind: "prepared" } satisfies PreparationResult;
  }
);

/** Atomically publishes one ready candidate and its model buffer pointers. */
export const activateCandidate = Effect.fn("contentRelease.activateCandidate")(
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
    const { recovery, recoverySigned, release, signed, state } =
      yield* validateCandidate(ctx, releaseId, rendererJson, manifestHash);
    yield* Effect.all([
      stagedEvidence(release, signed),
      stagedEvidence(recovery, recoverySigned),
    ]);
    const build = yield* requireReadyModelBuild(ctx, release, signed);
    const [runtime, recoveryRuntime, receipt] = yield* Effect.all([
      loadReleaseTryoutRuntime(ctx, signed),
      loadReleaseTryoutRuntime(ctx, recoverySigned),
      publicationReceipt(release, signed),
    ]);
    const now = yield* Clock.currentTimeMillis;
    yield* Effect.promise(() =>
      ctx.db.patch("contentReleases", recovery._id, {
        tryoutRuntimeBundleHash: recoveryRuntime.result?.bundle.bundleHash,
        updatedAt: now,
      })
    );
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
        candidateManifestHash: undefined,
        candidateReleaseId: undefined,
        candidateSequence: undefined,
        ...modelActivationFields(build, release, signed),
        updatedAt: now,
      })
    );
    yield* Effect.promise(() => ctx.db.delete("contentModelBuilds", build._id));
    return { kind: "activated", receipt } satisfies ActivationResult;
  }
);
