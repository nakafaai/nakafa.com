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
  validateCandidate,
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
      return {
        kind: "completed",
      } satisfies PreparationResult;
    }
    const { recovery, recoverySigned, release, signed, state } =
      yield* validateCandidate(ctx, releaseId, rendererJson, manifestHash);
    yield* Effect.all([
      stagedEvidence(release, signed),
      stagedEvidence(recovery, recoverySigned),
    ]);
    yield* ensureModelBuild(ctx, release, signed, state);
    return {
      kind: "prepared",
    } satisfies PreparationResult;
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
    yield* writer
      .table("contentReleases")
      .patch(recovery._id, {
        tryoutRuntimeBundleHash: recoveryRuntime.result?.bundle.bundleHash,
        updatedAt: now,
      })
      .pipe(Effect.orDie);
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
        candidateManifestHash: undefined,
        candidateReleaseId: undefined,
        candidateSequence: undefined,
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
