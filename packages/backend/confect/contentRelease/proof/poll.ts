import type { WorkflowId, WorkflowStatus } from "@convex-dev/workflow";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseWriter,
  MutationCtx as MutationCtxService,
} from "@repo/backend/confect/_generated/services";
import {
  type ReleaseError,
  releaseFail,
} from "@repo/backend/confect/contentRelease/error";
import { loadStaged } from "@repo/backend/confect/contentRelease/model";
import {
  decodeProofJson,
  decodeReleaseJson,
} from "@repo/backend/confect/contentRelease/parse";
import {
  proofFailureValidator,
  type proofPollValidator,
} from "@repo/backend/confect/contentRelease/proof/spec";
import { stagedEvidence } from "@repo/backend/confect/contentRelease/receipt";
import { beginVerification } from "@repo/backend/confect/contentRelease/verify";
import { workflow } from "@repo/backend/confect/workflow";
import { internal } from "@repo/backend/convex/_generated/api";
import { Clock, Context, Effect, Layer, Schema } from "effect";
export type ProofFailure = typeof proofFailureValidator.Type;
export type ProofPoll = typeof proofPollValidator.Type;
export type Release = Docs["contentReleases"];
/** Durable Workflow dependency owned only by proof polling. */
export class ProofPollCoordinator extends Context.Service<
  ProofPollCoordinator,
  {
    /** Removes terminal component state after its outcome is persisted. */
    readonly cleanup: (
      workflowId: WorkflowId
    ) => Effect.Effect<boolean, ReleaseError>;
    /** Starts one retryable proof workflow under the caller's transaction. */
    readonly start: (
      manifestHash: string,
      releaseId: string
    ) => Effect.Effect<WorkflowId, ReleaseError>;
    /** Reads the durable component outcome without exposing it publicly. */
    readonly status: (
      workflowId: WorkflowId
    ) => Effect.Effect<WorkflowStatus, ReleaseError>;
  }
>()("@repo/backend/contentRelease/ProofPollCoordinator") {}

/** The Workflow coordinator's shape, which a test runtime replaces with a fake. */
export type ProofPollCoordinatorService = Context.Service.Shape<
  typeof ProofPollCoordinator
>;
export const ProofPollCoordinatorLive = Layer.effect(
  ProofPollCoordinator,
  Effect.gen(function* () {
    const ctx = yield* MutationCtxService;
    return ProofPollCoordinator.of({
      cleanup: Effect.fn("contentRelease.proof.cleanup")((workflowId) =>
        Effect.promise(() => workflow.cleanup(ctx, workflowId))
      ),
      start: Effect.fn("contentRelease.proof.start")(
        (manifestHash, releaseId) =>
          Effect.promise(() =>
            workflow.start(
              ctx,
              internal.contentRelease.proof.workflow.verifyRelease,
              { manifestHash, releaseId },
              { startAsync: true }
            )
          )
      ),
      status: Effect.fn("contentRelease.proof.status")((workflowId) =>
        Effect.promise(() => workflow.status(ctx, workflowId))
      ),
    });
  })
);
const ProofWorkflowResolutionSchema = Schema.Union([
  Schema.Struct({
    phase: Schema.Literal("failed"),
    reason: proofFailureValidator,
  }),
  Schema.Struct({
    phase: Schema.Literal("ready"),
    proofJson: Schema.String,
  }),
  Schema.Struct({
    phase: Schema.Literal("verifying"),
  }),
]);
export type ProofWorkflowResolution = typeof ProofWorkflowResolutionSchema.Type;

/** Reduces durable component status to the proof state machine. */
export function resolveProofWorkflow(
  status: WorkflowStatus,
  proofJson: string | undefined
): ProofWorkflowResolution {
  if (status.type === "inProgress") {
    return {
      phase: "verifying",
    };
  }
  if (status.type === "completed") {
    if (proofJson === undefined) {
      return {
        phase: "failed",
        reason: "failed",
      };
    }
    return {
      phase: "ready",
      proofJson,
    };
  }
  return {
    phase: "failed",
    reason: status.type,
  };
}

/** Requires one request to name the immutable staged release exactly. */
const loadVerification = Effect.fn("contentRelease.loadVerification")(
  function* (manifestHash: string, releaseId: string) {
    const { release } = yield* loadStaged(releaseId);
    const signed = yield* decodeReleaseJson(release.releaseJson);
    if (signed.manifestHash !== manifestHash) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Content release ${releaseId} has a different manifest hash.`
      );
    }
    yield* stagedEvidence(release, signed);
    return release;
  }
);

/** Finalizes proof only after its coordinator completed successfully. */
export const finalizeProof = Effect.fn("contentRelease.finalizeProof")(
  function* (release: Release, proofJson: string) {
    const writer = yield* DatabaseWriter;
    yield* decodeProofJson(proofJson);
    const now = yield* Clock.currentTimeMillis;
    yield* writer
      .table("contentReleases")
      .patch(release._id, {
        proofFailure: undefined,
        proofWorkflowId: undefined,
        status: "verified",
        updatedAt: now,
        verifiedAt: now,
      })
      .pipe(Effect.orDie);
    return {
      phase: "verified",
      proofJson,
    } satisfies ProofPoll;
  }
);

/** Persists one sanitized terminal coordinator failure exactly once. */
export const failedProof = Effect.fn("contentRelease.failedProof")(function* (
  release: Release,
  reason: ProofFailure
) {
  const writer = yield* DatabaseWriter;
  yield* writer
    .table("contentReleases")
    .patch(release._id, {
      proofFailure: reason,
      proofAt: undefined,
      proofJson: undefined,
      proofWorkflowId: undefined,
      updatedAt: yield* Clock.currentTimeMillis,
    })
    .pipe(Effect.orDie);
  return {
    phase: "failed",
    reason,
  } satisfies ProofPoll;
});

/** Starts once or polls one durable proof coordinator for a signed release. */
export const pollProgram = Effect.fn("contentRelease.pollProof")(function* (
  manifestHash: string,
  releaseId: string
) {
  const writer = yield* DatabaseWriter;
  const release = yield* loadVerification(manifestHash, releaseId);
  if (release.status === "verified") {
    const proofJson = yield* Effect.fromNullishOr(release.proofJson).pipe(
      Effect.orDie
    );
    yield* decodeProofJson(proofJson);
    return {
      phase: "verified",
      proofJson,
    } satisfies ProofPoll;
  }
  const activeWorkflowId = release.proofWorkflowId;
  if (release.status === "verifying" && activeWorkflowId) {
    const coordinator = yield* ProofPollCoordinator;
    const status = yield* coordinator.status(activeWorkflowId);
    const resolution = resolveProofWorkflow(status, release.proofJson);
    if (resolution.phase === "verifying") {
      return {
        phase: "verifying",
      } satisfies ProofPoll;
    }
    const cleaned = yield* coordinator.cleanup(activeWorkflowId);
    if (!cleaned) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Proof workflow ${activeWorkflowId} could not be cleaned.`
      );
    }
    if (resolution.phase === "ready") {
      return yield* finalizeProof(release, resolution.proofJson);
    }
    return yield* failedProof(release, resolution.reason);
  }
  if (release.status === "verifying" && release.proofFailure) {
    return {
      phase: "failed",
      reason: release.proofFailure,
    } satisfies ProofPoll;
  }
  yield* beginVerification(releaseId);
  const coordinator = yield* ProofPollCoordinator;
  const proofWorkflowId = yield* coordinator.start(manifestHash, releaseId);
  yield* writer
    .table("contentReleases")
    .patch(release._id, {
      proofFailure: undefined,
      proofWorkflowId,
      updatedAt: yield* Clock.currentTimeMillis,
    })
    .pipe(Effect.orDie);
  return {
    phase: "verifying",
  } satisfies ProofPoll;
});
