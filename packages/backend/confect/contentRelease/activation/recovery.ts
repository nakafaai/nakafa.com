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
  validateRecovery,
} from "@repo/backend/confect/contentRelease/activation/validate";
import { loadRelease } from "@repo/backend/confect/contentRelease/model";
import { ensureModelBuild } from "@repo/backend/confect/contentRelease/models/build";
import {
  publicationReceipt,
  stagedEvidence,
} from "@repo/backend/confect/contentRelease/receipt";
import { loadReleaseTryoutRuntime } from "@repo/backend/confect/contentRelease/tryout/runtime";
import { Clock, Effect, Schema } from "effect";

/** Stores the receipt as plain JSON text, with the bytes JSON.stringify produces. */
const ReceiptJson = Schema.fromJsonString(Schema.Unknown);

/** Starts the inactive read-model build for one retained recovery. */
export const prepareRecovery = Effect.fn("contentRelease.prepareRecovery")(
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
    const { release, signed, state } = yield* validateRecovery(
      releaseId,
      rendererJson,
      manifestHash
    );
    yield* stagedEvidence(release, signed);
    yield* ensureModelBuild(release, signed, state);
    return {
      kind: "prepared",
    } satisfies PreparationResult;
  }
);

/** Atomically publishes one ready recovery and its model buffer pointers. */
export const activateRecovery = Effect.fn("contentRelease.activateRecovery")(
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
    const { release, signed, state } = yield* validateRecovery(
      releaseId,
      rendererJson,
      manifestHash
    );
    yield* stagedEvidence(release, signed);
    const build = yield* requireReadyModelBuild(release, signed);
    const [runtime, receipt] = yield* Effect.all([
      loadReleaseTryoutRuntime(signed),
      publicationReceipt(release, signed),
    ]);
    const now = yield* Clock.currentTimeMillis;
    yield* writer
      .table("contentReleases")
      .patch(release._id, {
        completedAt: now,
        receiptJson: yield* Schema.encodeEffect(ReceiptJson)(receipt).pipe(
          Effect.orDie
        ),
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
