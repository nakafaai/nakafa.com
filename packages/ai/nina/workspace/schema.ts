import {
  EvidenceStatusSchema,
  LEARNING_CAPABILITY_ARTIFACT_LIMIT,
  LearningCapabilityNameSchema,
} from "@repo/ai/nina/capability/spec";
import { PedagogyMove } from "@repo/ai/nina/pedagogy/schema";
import { findWorkspaceIssue } from "@repo/ai/nina/workspace/invariant";
import { findWorkspaceArtifactPreflightIssue } from "@repo/ai/nina/workspace/preflight";
import { MAX_COORDINATE_ARTIFACT_BYTES } from "@repo/math/schema/artifact/safety";
import type { LearningArtifact } from "@repo/math/schema/artifact/schema";
import {
  decodeLearningArtifact,
  LearningArtifactSchema,
} from "@repo/math/schema/artifact/schema";
import { Effect, Schema } from "effect";

export const EVIDENCE_WORKSPACE_CONTRIBUTION_LIMIT = 20;
export const EVIDENCE_CONTRIBUTION_ARTIFACT_LIMIT =
  LEARNING_CAPABILITY_ARTIFACT_LIMIT;
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

/**
 * Decodes a workspace and verifies cross-field and artifact invariants.
 */
export const decodeEvidenceWorkspace = Effect.fn(
  "nina.workspace.decodeEvidenceWorkspace"
)(function* (input: unknown) {
  const preflightIssue = yield* findWorkspaceArtifactPreflightIssue(input, {
    artifactBytes: MAX_COORDINATE_ARTIFACT_BYTES,
    contributionLimit: EVIDENCE_WORKSPACE_CONTRIBUTION_LIMIT,
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

/**
 * Creates an empty evidence workspace for one Nina turn.
 */
export const createEvidenceWorkspace = Effect.fn(
  "nina.workspace.createEvidenceWorkspace"
)(function* (input: { createdAt: number; turnId: string }) {
  return yield* decodeEvidenceWorkspace({
    contributions: [],
    createdAt: input.createdAt,
    turnId: input.turnId,
  });
});

/**
 * Appends one contribution while preserving workspace invariants.
 */
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

/**
 * Flattens retained artifacts so decode can validate global artifact identity.
 */
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
