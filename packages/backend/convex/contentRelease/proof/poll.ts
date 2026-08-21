import type { WorkflowId, WorkflowStatus } from "@convex-dev/workflow";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import {
  type ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { loadStaged } from "@repo/backend/convex/contentRelease/model";
import {
  decodeProofJson,
  decodeReleaseJson,
} from "@repo/backend/convex/contentRelease/parse";
import {
  type proofFailureValidator,
  proofPollValidator,
} from "@repo/backend/convex/contentRelease/proof/spec";
import { stagedEvidence } from "@repo/backend/convex/contentRelease/receipt";
import { beginVerification } from "@repo/backend/convex/contentRelease/verify";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { workflow } from "@repo/backend/convex/workflow";
import { type Infer, v } from "convex/values";
import { Context, Effect, Layer } from "effect";

type ProofFailure = Infer<typeof proofFailureValidator>;
type ProofPoll = Infer<typeof proofPollValidator>;
type Release = Doc<"contentReleases">;
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

const proofPollCoordinatorLive: ProofPollCoordinatorService = {
  cleanup: (ctx, workflowId) =>
    callInternal(() => workflow.cleanup(ctx, workflowId)),
  start: (ctx, manifestHash, releaseId) =>
    callInternal(() =>
      workflow.start(
        ctx,
        internal.contentRelease.proof.workflow.verifyRelease,
        { manifestHash, releaseId },
        { startAsync: true }
      )
    ),
  status: (ctx, workflowId) =>
    callInternal(() => workflow.status(ctx, workflowId)),
};
const ProofPollCoordinatorLive = Layer.succeed(
  ProofPollCoordinator,
  proofPollCoordinatorLive
);

type ProofWorkflowResolution =
  | { readonly phase: "failed"; readonly reason: ProofFailure }
  | { readonly phase: "ready"; readonly proofJson: string }
  | { readonly phase: "verifying" };

/** Reduces durable component status to the proof state machine. */
export function resolveProofWorkflow(
  status: WorkflowStatus,
  proofJson: string | undefined
): ProofWorkflowResolution {
  if (status.type === "inProgress") {
    return { phase: "verifying" };
  }
  if (status.type === "completed") {
    if (proofJson === undefined) {
      return { phase: "failed", reason: "failed" };
    }
    return { phase: "ready", proofJson };
  }
  return { phase: "failed", reason: status.type };
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

/** Returns already-final proof without recreating coordinator state. */
const readVerifiedProof = Effect.fn("contentRelease.readVerifiedProof")(
  function* (release: Release) {
    if (release.proofJson === undefined) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Verified release ${release.releaseId} has no proof.`
      );
    }
    yield* decodeProofJson(release.proofJson);
    return {
      phase: "verified",
      proofJson: release.proofJson,
    } satisfies ProofPoll;
  }
);

/** Finalizes proof only after its coordinator completed successfully. */
export const finalizeProof = Effect.fn("contentRelease.finalizeProof")(
  function* (ctx: MutationCtx, release: Release, proofJson: string) {
    yield* decodeProofJson(proofJson);
    const now = Date.now();
    yield* Effect.promise(() =>
      ctx.db.patch("contentReleases", release._id, {
        proofFailure: undefined,
        proofWorkflowId: undefined,
        status: "verified",
        updatedAt: now,
        verifiedAt: release.verifiedAt ?? now,
      })
    );
    return {
      phase: "verified",
      proofJson,
    } satisfies ProofPoll;
  }
);

/** Persists one sanitized terminal coordinator failure exactly once. */
const failedProof = Effect.fn("contentRelease.failedProof")(function* (
  ctx: MutationCtx,
  release: Release,
  reason: ProofFailure
) {
  yield* Effect.promise(() =>
    ctx.db.patch("contentReleases", release._id, {
      proofFailure: reason,
      proofAt: undefined,
      proofJson: undefined,
      proofWorkflowId: undefined,
      updatedAt: Date.now(),
    })
  );
  return { phase: "failed", reason } satisfies ProofPoll;
});

/** Starts once or polls one durable proof coordinator for a signed release. */
export const pollProgram: (
  ctx: MutationCtx,
  manifestHash: string,
  releaseId: string
) => Effect.Effect<ProofPoll, ReleaseError, ProofPollCoordinator> = Effect.fn(
  "contentRelease.pollProof"
)(function* (ctx: MutationCtx, manifestHash: string, releaseId: string) {
  const release = yield* loadVerification(ctx, manifestHash, releaseId);
  if (release.status === "verified") {
    return yield* readVerifiedProof(release);
  }
  const activeWorkflowId = release.proofWorkflowId;
  if (release.status === "verifying" && activeWorkflowId) {
    const coordinator = yield* ProofPollCoordinator;
    const status = yield* coordinator.status(ctx, activeWorkflowId);
    const resolution = resolveProofWorkflow(status, release.proofJson);
    if (resolution.phase === "verifying") {
      return { phase: "verifying" } satisfies ProofPoll;
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
  yield* Effect.promise(() =>
    ctx.db.patch("contentReleases", release._id, {
      proofFailure: undefined,
      proofWorkflowId,
      updatedAt: Date.now(),
    })
  );
  return { phase: "verifying" } satisfies ProofPoll;
});

/** Starts or observes the durable proof workflow without blocking HTTP. */
export const poll = internalMutation({
  args: {
    manifestHash: v.string(),
    releaseId: v.string(),
  },
  returns: proofPollValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      pollProgram(ctx, args.manifestHash, args.releaseId).pipe(
        Effect.provide(ProofPollCoordinatorLive)
      )
    ),
});
