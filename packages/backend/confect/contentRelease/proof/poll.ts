import { DatabaseWriter } from "@confect/server";
import type { WorkflowId, WorkflowStatus } from "@convex-dev/workflow";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  type ReleaseError,
  releaseFail,
} from "@repo/backend/confect/contentRelease/error";
import { loadStaged } from "@repo/backend/confect/contentRelease/model";
import {
  decodeProofJson,
  decodeReleaseJson,
} from "@repo/backend/confect/contentRelease/parse";
import type {
  proofFailureValidator,
  proofPollValidator,
} from "@repo/backend/confect/contentRelease/proof/spec";
import { stagedEvidence } from "@repo/backend/confect/contentRelease/receipt";
import { beginVerification } from "@repo/backend/confect/contentRelease/verify";
import { workflow } from "@repo/backend/confect/workflow";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Clock, Context, Effect, Layer, type Schema } from "effect";
export type ProofFailure = Schema.Schema.Type<typeof proofFailureValidator>;
export type ProofPoll = Schema.Schema.Type<typeof proofPollValidator>;
export type Release = Doc<"contentReleases">;
export interface ProofPollCoordinatorService {
  /** Removes terminal component state after its outcome is persisted. */
  readonly cleanup: (
    ctx: MutationCtx,
    workflowId: WorkflowId
  ) => Effect.Effect<boolean, ReleaseError>;
  /** Starts one retryable proof workflow under the caller's transaction. */
  readonly start: (
    ctx: MutationCtx,
    manifestHash: string,
    releaseId: string
  ) => Effect.Effect<WorkflowId, ReleaseError>;
  /** Reads the durable component outcome without exposing it publicly. */
  readonly status: (
    ctx: MutationCtx,
    workflowId: WorkflowId
  ) => Effect.Effect<WorkflowStatus, ReleaseError>;
}

/** Durable Workflow dependency owned only by proof polling. */
export class ProofPollCoordinator extends Context.Service<
  ProofPollCoordinator,
  ProofPollCoordinatorService
>()("@repo/backend/contentRelease/ProofPollCoordinator") {}
export const proofPollCoordinatorLive: ProofPollCoordinatorService = {
  cleanup: (ctx, workflowId) =>
    Effect.promise(() => workflow.cleanup(ctx, workflowId)),
  start: (ctx, manifestHash, releaseId) =>
    Effect.promise(() =>
      workflow.start(
        ctx,
        internal.contentRelease.proof.workflow.verifyRelease,
        {
          manifestHash,
          releaseId,
        },
        {
          startAsync: true,
        }
      )
    ),
  status: (ctx, workflowId) =>
    Effect.promise(() => workflow.status(ctx, workflowId)),
};
export const ProofPollCoordinatorLive = Layer.succeed(
  ProofPollCoordinator,
  proofPollCoordinatorLive
);
export type ProofWorkflowResolution =
  | {
      readonly phase: "failed";
      readonly reason: ProofFailure;
    }
  | {
      readonly phase: "ready";
      readonly proofJson: string;
    }
  | {
      readonly phase: "verifying";
    };

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
  function* (ctx: MutationCtx, manifestHash: string, releaseId: string) {
    const { release } = yield* loadStaged(ctx, releaseId);
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
  function* (ctx: MutationCtx, release: Release, proofJson: string) {
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
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
  ctx: MutationCtx,
  release: Release,
  reason: ProofFailure
) {
  const writer = DatabaseWriter.make(databaseSchema, ctx.db);
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
export const pollProgram: (
  ctx: MutationCtx,
  manifestHash: string,
  releaseId: string
) => Effect.Effect<ProofPoll, ReleaseError, ProofPollCoordinator> = Effect.fn(
  "contentRelease.pollProof"
)(function* (ctx: MutationCtx, manifestHash: string, releaseId: string) {
  const writer = DatabaseWriter.make(databaseSchema, ctx.db);
  const release = yield* loadVerification(ctx, manifestHash, releaseId);
  if (release.status === "verified") {
    const proofJson = yield* Effect.fromNullishOr(release.proofJson).pipe(
      Effect.orDie
    );
    yield* decodeProofJson(proofJson);
    return { phase: "verified", proofJson } satisfies ProofPoll;
  }
  const activeWorkflowId = release.proofWorkflowId;
  if (release.status === "verifying" && activeWorkflowId) {
    const coordinator = yield* ProofPollCoordinator;
    const status = yield* coordinator.status(ctx, activeWorkflowId);
    const resolution = resolveProofWorkflow(status, release.proofJson);
    if (resolution.phase === "verifying") {
      return {
        phase: "verifying",
      } satisfies ProofPoll;
    }
    const cleaned = yield* coordinator.cleanup(ctx, activeWorkflowId);
    if (!cleaned) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Proof workflow ${activeWorkflowId} could not be cleaned.`
      );
    }
    if (resolution.phase === "ready") {
      return yield* finalizeProof(ctx, release, resolution.proofJson);
    }
    return yield* failedProof(ctx, release, resolution.reason);
  }
  if (release.status === "verifying" && release.proofFailure) {
    return {
      phase: "failed",
      reason: release.proofFailure,
    } satisfies ProofPoll;
  }
  yield* beginVerification(ctx, releaseId);
  const coordinator = yield* ProofPollCoordinator;
  const proofWorkflowId = yield* coordinator.start(
    ctx,
    manifestHash,
    releaseId
  );
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
