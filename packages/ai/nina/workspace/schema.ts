import {
  EvidenceStatusSchema,
  LearningCapabilityNameSchema,
} from "@repo/ai/nina/capability/spec";
import { PedagogyMove } from "@repo/ai/nina/pedagogy/schema";
import { findWorkspaceArtifactPreflightIssue } from "@repo/ai/nina/workspace/preflight";
import type { LearningArtifact } from "@repo/math/schema/artifact";
import {
  decodeLearningArtifact,
  LearningArtifactSchema,
  MAX_COORDINATE_ARTIFACT_BYTES,
} from "@repo/math/schema/artifact";
import { Effect, Schema } from "effect";

export const EVIDENCE_WORKSPACE_CONTRIBUTION_LIMIT = 20;
export const EVIDENCE_CONTRIBUTION_ARTIFACT_LIMIT = 3;
export const EVIDENCE_WORKSPACE_ARTIFACT_LIMIT = 8;
export const EVIDENCE_CONTRIBUTION_ARTIFACT_BYTES =
  MAX_COORDINATE_ARTIFACT_BYTES * 2;
export const EVIDENCE_WORKSPACE_ARTIFACT_BYTES =
  MAX_COORDINATE_ARTIFACT_BYTES * 4;
export const EVIDENCE_CONTRIBUTION_MODEL_SUMMARY_MAX_LENGTH = 1200;
export const EVIDENCE_CONTRIBUTION_PEDAGOGY_MOVE_LIMIT = 6;
export const EVIDENCE_CONTRIBUTION_SUMMARY_MAX_LENGTH = 1200;
export const EVIDENCE_CONTRIBUTION_LIMITATION_LIMIT = 6;
export const EVIDENCE_CONTRIBUTION_LIMITATION_MAX_LENGTH = 300;
export const EVIDENCE_CONTRIBUTION_REF_LIMIT = 12;
export const EVIDENCE_CONTRIBUTION_REF_MAX_LENGTH = 180;
export const EVIDENCE_WORKSPACE_TURN_ID_MAX_LENGTH = 180;

const WorkspaceEvidenceRef = Schema.NonEmptyString.pipe(
  Schema.pattern(/\S/),
  Schema.maxLength(EVIDENCE_CONTRIBUTION_REF_MAX_LENGTH)
);

const EvidenceWorkspaceTurnId = Schema.NonEmptyString.pipe(
  Schema.pattern(/\S/),
  Schema.maxLength(EVIDENCE_WORKSPACE_TURN_ID_MAX_LENGTH)
);

/** Bounded evidence envelope retained from one Nina capability contribution. */
export class WorkspaceEvidenceEnvelope extends Schema.Class<WorkspaceEvidenceEnvelope>(
  "WorkspaceEvidenceEnvelope"
)({
  capability: LearningCapabilityNameSchema,
  limitations: Schema.optional(
    Schema.Array(
      Schema.NonEmptyString.pipe(
        Schema.maxLength(EVIDENCE_CONTRIBUTION_LIMITATION_MAX_LENGTH)
      )
    ).pipe(
      Schema.maxItems(EVIDENCE_CONTRIBUTION_LIMITATION_LIMIT),
      Schema.mutable
    )
  ),
  refs: Schema.optional(
    Schema.Array(WorkspaceEvidenceRef).pipe(
      Schema.maxItems(EVIDENCE_CONTRIBUTION_REF_LIMIT),
      Schema.mutable
    )
  ),
  status: EvidenceStatusSchema,
  summary: Schema.String.pipe(
    Schema.maxLength(EVIDENCE_CONTRIBUTION_SUMMARY_MAX_LENGTH)
  ),
}) {}

/** Bounded contribution carrying evidence, artifacts, and pedagogy moves. */
export class CapabilityContribution extends Schema.Class<CapabilityContribution>(
  "CapabilityContribution"
)({
  artifacts: Schema.optional(
    Schema.Array(LearningArtifactSchema).pipe(
      Schema.maxItems(EVIDENCE_CONTRIBUTION_ARTIFACT_LIMIT),
      Schema.mutable
    )
  ),
  capability: LearningCapabilityNameSchema,
  evidence: WorkspaceEvidenceEnvelope,
  modelSummary: Schema.NonEmptyString.pipe(
    Schema.maxLength(EVIDENCE_CONTRIBUTION_MODEL_SUMMARY_MAX_LENGTH)
  ),
  pedagogyMoves: Schema.optional(
    Schema.Array(PedagogyMove).pipe(
      Schema.maxItems(EVIDENCE_CONTRIBUTION_PEDAGOGY_MOVE_LIMIT),
      Schema.mutable
    )
  ),
}) {}

/** Turn-scoped workspace used by Nina capabilities to share evidence. */
export class EvidenceWorkspace extends Schema.Class<EvidenceWorkspace>(
  "EvidenceWorkspace"
)({
  contributions: Schema.Array(CapabilityContribution).pipe(
    Schema.mutable,
    Schema.maxItems(EVIDENCE_WORKSPACE_CONTRIBUTION_LIMIT)
  ),
  createdAt: Schema.Number.pipe(
    Schema.finite(),
    Schema.int(),
    Schema.nonNegative()
  ),
  turnId: EvidenceWorkspaceTurnId,
}) {}

/** Expected failure raised when an evidence workspace fails validation. */
export class EvidenceWorkspaceDecodeError extends Schema.TaggedError<EvidenceWorkspaceDecodeError>()(
  "EvidenceWorkspaceDecodeError",
  {
    message: Schema.String,
  }
) {}

/** Expected failure raised when a workspace would exceed bounded retention. */
export class EvidenceWorkspaceLimitExceeded extends Schema.TaggedError<EvidenceWorkspaceLimitExceeded>()(
  "EvidenceWorkspaceLimitExceeded",
  {
    limit: Schema.Number,
    message: Schema.String,
  }
) {}

/** Decodes a workspace and verifies cross-field and artifact invariants. */
export const decodeEvidenceWorkspace = Effect.fn(
  "nina.workspace.decodeEvidenceWorkspace"
)(function* (input: unknown) {
  const preflightIssue = yield* findWorkspaceArtifactPreflightIssue(input, {
    artifactBytes: MAX_COORDINATE_ARTIFACT_BYTES,
    contributionArtifactBytes: EVIDENCE_CONTRIBUTION_ARTIFACT_BYTES,
    contributionArtifactLimit: EVIDENCE_CONTRIBUTION_ARTIFACT_LIMIT,
    workspaceArtifactBytes: EVIDENCE_WORKSPACE_ARTIFACT_BYTES,
    workspaceArtifactLimit: EVIDENCE_WORKSPACE_ARTIFACT_LIMIT,
  }).pipe(
    Effect.mapError(
      (error) => new EvidenceWorkspaceDecodeError({ message: error.message })
    )
  );
  if (preflightIssue) {
    return yield* Effect.fail(
      new EvidenceWorkspaceDecodeError({ message: preflightIssue })
    );
  }

  const workspace = yield* Schema.decodeUnknown(EvidenceWorkspace)(input).pipe(
    Effect.mapError(
      () =>
        new EvidenceWorkspaceDecodeError({
          message: "Invalid evidence workspace contract.",
        })
    )
  );

  const issue = findWorkspaceIssue(workspace);
  if (issue) {
    return yield* Effect.fail(
      new EvidenceWorkspaceDecodeError({ message: issue })
    );
  }

  for (const artifact of readWorkspaceArtifacts(workspace)) {
    yield* decodeLearningArtifact(artifact).pipe(
      Effect.mapError(
        (error) => new EvidenceWorkspaceDecodeError({ message: error.message })
      )
    );
  }

  return workspace;
});

/** Creates an empty evidence workspace for one Nina turn. */
export const createEvidenceWorkspace = Effect.fn(
  "nina.workspace.createEvidenceWorkspace"
)(function* (input: { createdAt: number; turnId: string }) {
  return yield* decodeEvidenceWorkspace({
    contributions: [],
    createdAt: input.createdAt,
    turnId: input.turnId,
  });
});

/** Appends one contribution while preserving workspace invariants. */
export const appendCapabilityContribution = Effect.fn(
  "nina.workspace.appendCapabilityContribution"
)(function* (
  workspace: EvidenceWorkspace,
  contribution: CapabilityContribution
) {
  if (workspace.contributions.length >= EVIDENCE_WORKSPACE_CONTRIBUTION_LIMIT) {
    return yield* Effect.fail(
      new EvidenceWorkspaceLimitExceeded({
        limit: EVIDENCE_WORKSPACE_CONTRIBUTION_LIMIT,
        message: "Evidence workspace contribution limit exceeded.",
      })
    );
  }

  return yield* decodeEvidenceWorkspace({
    ...workspace,
    contributions: [...workspace.contributions, contribution],
  });
});

function findWorkspaceIssue(workspace: EvidenceWorkspace) {
  const artifactIds = new Set<string>();

  for (const contribution of workspace.contributions) {
    if (contribution.capability !== contribution.evidence.capability) {
      return `Contribution capability ${contribution.capability} does not match evidence capability ${contribution.evidence.capability}.`;
    }

    const unavailableIssue = findUnavailableEvidenceIssue(contribution);
    if (unavailableIssue) {
      return unavailableIssue;
    }

    const refsIssue = findPedagogyRefsIssue(contribution);
    if (refsIssue) {
      return refsIssue;
    }

    const artifacts = contribution.artifacts;
    if (!artifacts) {
      continue;
    }

    for (const artifact of artifacts) {
      if (artifactIds.has(artifact.id)) {
        return `Duplicate learning artifact id: ${artifact.id}.`;
      }
      artifactIds.add(artifact.id);
    }
  }
}

function findUnavailableEvidenceIssue(contribution: CapabilityContribution) {
  if (
    contribution.evidence.status !== "failed" &&
    contribution.evidence.status !== "denied"
  ) {
    return;
  }

  if (contribution.artifacts?.length) {
    return `Contribution ${contribution.capability} cannot attach artifacts when evidence status is ${contribution.evidence.status}.`;
  }

  if (contribution.pedagogyMoves?.length) {
    return `Contribution ${contribution.capability} cannot attach pedagogy moves when evidence status is ${contribution.evidence.status}.`;
  }
}

function findPedagogyRefsIssue(contribution: CapabilityContribution) {
  if (!contribution.pedagogyMoves) {
    return;
  }

  const allowedRefs = new Set<string>();

  if (contribution.evidence.refs) {
    for (const ref of contribution.evidence.refs) {
      allowedRefs.add(ref);
    }
  }

  if (contribution.artifacts) {
    for (const artifact of contribution.artifacts) {
      allowedRefs.add(artifact.id);
    }
  }

  for (const move of contribution.pedagogyMoves) {
    for (const ref of move.evidenceRefs) {
      if (!allowedRefs.has(ref)) {
        return `Pedagogy move ${move.kind} references unknown evidence ${ref}.`;
      }
    }
  }
}

function readWorkspaceArtifacts(workspace: EvidenceWorkspace) {
  const artifacts: LearningArtifact[] = [];

  for (const contribution of workspace.contributions) {
    if (!contribution.artifacts) {
      continue;
    }
    artifacts.push(...contribution.artifacts);
  }

  return artifacts;
}
