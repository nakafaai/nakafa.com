import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
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
import { Clock, Effect } from "effect";

/** Starts the invisible read-model build after full candidate validation. */
export const prepareCandidate = Effect.fn("contentRelease.prepareCandidate")(
  function* (releaseId: string, rendererJson: string, manifestHash: string) {
    const stored = yield* loadRelease(releaseId);
    yield* validateActivationRenderer(
      releaseId,
      stored.releaseJson,
      stored.rendererJson,
      rendererJson,
      manifestHash
    );
    if (stored.status === "completed") {
      yield* completedActivation(releaseId, stored);
      return {
        kind: "completed",
      } satisfies PreparationResult;
    }
    const { recovery, recoverySigned, release, signed, state } =
      yield* validateCandidate(releaseId, rendererJson, manifestHash);
    yield* Effect.all([
      stagedEvidence(release, signed),
      stagedEvidence(recovery, recoverySigned),
    ]);
    yield* ensureModelBuild(release, signed, state);
    return {
      kind: "prepared",
    } satisfies PreparationResult;
  }
);

/** Atomically publishes one ready candidate and its model buffer pointers. */
export const activateCandidate = Effect.fn("contentRelease.activateCandidate")(
  function* (releaseId: string, rendererJson: string, manifestHash: string) {
    const writer = yield* DatabaseWriter;
    const stored = yield* loadRelease(releaseId);
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
        receipt: yield* completedActivation(releaseId, stored),
      } satisfies ActivationResult;
    }
    const { recovery, recoverySigned, release, signed, state } =
      yield* validateCandidate(releaseId, rendererJson, manifestHash);
    yield* Effect.all([
      stagedEvidence(release, signed),
      stagedEvidence(recovery, recoverySigned),
    ]);
    const build = yield* requireReadyModelBuild(release, signed);
    const [runtime, recoveryRuntime, receipt] = yield* Effect.all([
      loadReleaseTryoutRuntime(signed),
      loadReleaseTryoutRuntime(recoverySigned),
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
