import type { WorkflowId, WorkflowStatus } from "@convex-dev/workflow";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseWriter,
  MutationCtx as MutationCtxService,
  QueryCtx as QueryCtxService,
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
  type proofStatusValidator,
} from "@repo/backend/confect/contentRelease/proof/spec";
import { stagedEvidence } from "@repo/backend/confect/contentRelease/receipt";
import { beginVerification } from "@repo/backend/confect/contentRelease/verify";
import { workflow } from "@repo/backend/confect/workflow";
import { internal } from "@repo/backend/convex/_generated/api";
import { Clock, Context, Effect, Layer, Match, Schema } from "effect";
export type ProofFailure = typeof proofFailureValidator.Type;
export type ProofPoll = typeof proofPollValidator.Type;
export type ProofStatus = typeof proofStatusValidator.Type;
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
/** Durable Workflow status for proof polling, the only Workflow operation a query may run. */
export class ProofPollStatus extends Context.Service<
  ProofPollStatus,
  {
    /** Reads the durable component outcome without starting, canceling, or cleaning it. */
    readonly status: (
      workflowId: WorkflowId
    ) => Effect.Effect<WorkflowStatus, ReleaseError>;
  }
>()("@repo/backend/contentRelease/ProofPollStatus") {}

/** Reads Workflow status through a query context, which cannot start or clean one. */
export const ProofPollStatusLive = Layer.effect(
  ProofPollStatus,
  Effect.gen(function* () {
    const ctx = yield* QueryCtxService;
    return ProofPollStatus.of({
      status: Effect.fn("contentRelease.proof.pollStatus")((workflowId) =>
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

/** One proof poll decision: the next step that the release row and its workflow require. */
const ProofDecisionSchema = Schema.Union([
  Schema.Struct({
    phase: Schema.Literal("failed"),
    reason: proofFailureValidator,
  }),
  Schema.Struct({
    phase: Schema.Literal("fail"),
    reason: proofFailureValidator,
    workflowId: Schema.Opaque<WorkflowId>()(Schema.String),
  }),
  Schema.Struct({
    phase: Schema.Literal("finalize"),
    proofJson: Schema.String,
    workflowId: Schema.Opaque<WorkflowId>()(Schema.String),
  }),
  Schema.Struct({
    phase: Schema.Literal("start"),
  }),
  Schema.Struct({
    phase: Schema.Literal("verified"),
    proofJson: Schema.UndefinedOr(Schema.String),
  }),
  Schema.Struct({
    phase: Schema.Literal("verifying"),
  }),
]);
type ProofDecision = typeof ProofDecisionSchema.Type;

/** Reads the status of the one proof workflow that a verifying release names. */
const readActiveProof = Effect.fn("contentRelease.readActiveProof")(function* (
  release: Release,
  status: (
    workflowId: WorkflowId
  ) => Effect.Effect<WorkflowStatus, ReleaseError>
) {
  if (release.status !== "verifying" || release.proofWorkflowId === undefined) {
    return;
  }
  const workflowId = release.proofWorkflowId;
  return {
    status: yield* status(workflowId),
    workflowId,
  };
});

/**
 * Decides the next proof step from the release row. The workflow status is
 * supplied exactly when the release is verifying with an active workflow.
 */
function decideProof(
  release: Release,
  active:
    | { readonly status: WorkflowStatus; readonly workflowId: WorkflowId }
    | undefined
): ProofDecision {
  if (release.status === "verified") {
    return {
      phase: "verified",
      proofJson: release.proofJson,
    } satisfies ProofDecision;
  }
  if (active !== undefined) {
    return Match.value(
      resolveProofWorkflow(active.status, release.proofJson)
    ).pipe(
      Match.discriminatorsExhaustive("phase")({
        failed: ({ reason }) =>
          ({
            phase: "fail",
            reason,
            workflowId: active.workflowId,
          }) satisfies ProofDecision,
        ready: ({ proofJson }) =>
          ({
            phase: "finalize",
            proofJson,
            workflowId: active.workflowId,
          }) satisfies ProofDecision,
        verifying: () => ({ phase: "verifying" }) satisfies ProofDecision,
      })
    );
  }
  if (release.status === "verifying" && release.proofFailure !== undefined) {
    return {
      phase: "failed",
      reason: release.proofFailure,
    } satisfies ProofDecision;
  }
  return { phase: "start" } satisfies ProofDecision;
}

/** Answers a stored proof only after it still satisfies its exact contract. */
const verifiedProof = Effect.fn("contentRelease.verifiedProof")(function* (
  proofJson: string | undefined
) {
  const stored = yield* Effect.fromNullishOr(proofJson).pipe(Effect.orDie);
  yield* decodeProofJson(stored);
  return {
    phase: "verified",
    proofJson: stored,
  } satisfies ProofPoll;
});

/** Removes one terminal proof workflow or fails without losing its identity. */
const removeProofWorkflow = Effect.fn("contentRelease.removeProofWorkflow")(
  function* (workflowId: WorkflowId) {
    const coordinator = yield* ProofPollCoordinator;
    const cleaned = yield* coordinator.cleanup(workflowId);
    if (!cleaned) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Proof workflow ${workflowId} could not be cleaned.`
      );
    }
  }
);

/** Starts the one proof workflow a staged release may own, then records its identity. */
const startProof = Effect.fn("contentRelease.startProof")(function* (
  manifestHash: string,
  release: Release
) {
  const writer = yield* DatabaseWriter;
  yield* beginVerification(release.releaseId);
  const coordinator = yield* ProofPollCoordinator;
  const proofWorkflowId = yield* coordinator.start(
    manifestHash,
    release.releaseId
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

/** Starts once or polls one durable proof coordinator for a signed release. */
export const pollProgram = Effect.fn("contentRelease.pollProof")(function* (
  manifestHash: string,
  releaseId: string
) {
  const release = yield* loadVerification(manifestHash, releaseId);
  const coordinator = yield* ProofPollCoordinator;
  const active = yield* readActiveProof(release, coordinator.status);
  return yield* Match.value(decideProof(release, active)).pipe(
    Match.discriminatorsExhaustive("phase")({
      failed: ({ reason }) =>
        Effect.succeed({ phase: "failed", reason } satisfies ProofPoll),
      fail: ({ reason, workflowId }) =>
        removeProofWorkflow(workflowId).pipe(
          Effect.andThen(failedProof(release, reason))
        ),
      finalize: ({ proofJson, workflowId }) =>
        removeProofWorkflow(workflowId).pipe(
          Effect.andThen(finalizeProof(release, proofJson))
        ),
      start: () => startProof(manifestHash, release),
      verified: ({ proofJson }) => verifiedProof(proofJson),
      verifying: () =>
        Effect.succeed({ phase: "verifying" } satisfies ProofPoll),
    })
  );
});

const pendingPoll = { phase: "pending" } satisfies ProofStatus;

/** Answers the poll without writing: `pending` names the one case that must run the poll mutation. */
export const pollStatusProgram = Effect.fn("contentRelease.pollStatus")(
  function* (manifestHash: string, releaseId: string) {
    const release = yield* loadVerification(manifestHash, releaseId);
    const statusReader = yield* ProofPollStatus;
    const active = yield* readActiveProof(release, statusReader.status);
    return yield* Match.value(decideProof(release, active)).pipe(
      Match.discriminatorsExhaustive("phase")({
        failed: ({ reason }) =>
          Effect.succeed({ phase: "failed", reason } satisfies ProofStatus),
        fail: () => Effect.succeed(pendingPoll),
        finalize: () => Effect.succeed(pendingPoll),
        start: () => Effect.succeed(pendingPoll),
        verified: ({ proofJson }) => verifiedProof(proofJson),
        verifying: () =>
          Effect.succeed({ phase: "verifying" } satisfies ProofStatus),
      })
    );
  }
);
