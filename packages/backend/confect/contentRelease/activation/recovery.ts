import { DatabaseWriter } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { completedActivation } from "@repo/backend/confect/contentRelease/activation/complete";
import {
  modelActivationFields,
  requireReadyModelBuild,
} from "@repo/backend/confect/contentRelease/activation/model";
import type {
  ActivationResult,
  PreparationResult,
} from "@repo/backend/confect/contentRelease/activation/spec";
import {
  validateActivationRenderer,
  validateRecovery,
} from "@repo/backend/confect/contentRelease/activation/validate";
import { loadRelease } from "@repo/backend/confect/contentRelease/model";
import { ensureModelBuild } from "@repo/backend/confect/contentRelease/models/build";
import {
  publicationReceipt,
  stagedEvidence,
} from "@repo/backend/confect/contentRelease/receipt";
import { loadReleaseTryoutRuntime } from "@repo/backend/confect/contentRelease/tryout/runtime";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
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
      return {
        kind: "completed",
      } satisfies PreparationResult;
    }
    const { release, signed, state } = yield* validateRecovery(
      ctx,
      releaseId,
      rendererJson,
      manifestHash
    );
    yield* stagedEvidence(release, signed);
    yield* ensureModelBuild(ctx, release, signed, state);
    return {
      kind: "prepared",
    } satisfies PreparationResult;
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
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
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
    yield* writer
      .table("contentReleases")
      .patch(release._id, {
        completedAt: now,
        receiptJson: JSON.stringify(receipt),
        status: "completed",
        tryoutRuntimeBundleHash: runtime.result?.bundle.bundleHash,
        updatedAt: now,
      })
      .pipe(Effect.orDie);
    yield* writer
      .table("contentState")
      .patch(state._id, {
        activeManifestHash: manifestHash,
        activeReleaseId: releaseId,
        activeSequence: release.sequence,
        recoveryManifestHash: undefined,
        recoveryReleaseId: undefined,
        recoverySequence: undefined,
        ...modelActivationFields(build, release, signed),
        updatedAt: now,
      })
      .pipe(Effect.orDie);
    yield* writer.table("contentModelBuilds").delete(build._id);
    return {
      kind: "activated",
      receipt,
    } satisfies ActivationResult;
  }
);
