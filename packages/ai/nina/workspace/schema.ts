import {
  EvidenceEnvelope,
  LearningCapabilityNameSchema,
} from "@repo/ai/nina/capability/spec";
import { PedagogyMove } from "@repo/ai/nina/pedagogy/schema";
import type { LearningArtifact } from "@repo/math/schema/artifact";
import {
  decodeLearningArtifact,
  LearningArtifactSchema,
} from "@repo/math/schema/artifact";
import { Effect, Schema } from "effect";

export const EVIDENCE_WORKSPACE_CONTRIBUTION_LIMIT = 20;

/**
 * One bounded contribution from a Nina learning capability.
 *
 * Contributions carry model-visible evidence summaries, deterministic
 * artifacts, and pedagogy moves. They intentionally exclude raw specialist
 * transcripts and provider payloads.
 */
export class CapabilityContribution extends Schema.Class<CapabilityContribution>(
  "CapabilityContribution"
)({
  artifacts: Schema.optional(
    Schema.Array(LearningArtifactSchema).pipe(Schema.mutable)
  ),
  capability: LearningCapabilityNameSchema,
  evidence: EvidenceEnvelope,
  modelSummary: Schema.NonEmptyString,
  pedagogyMoves: Schema.optional(
    Schema.Array(PedagogyMove).pipe(Schema.mutable)
  ),
}) {}

/**
 * Turn-scoped workspace used by capabilities to cooperate through evidence.
 *
 * This is the internal contract behind the public Nina harness. App-facing
 * chat parts should reference persisted artifacts by id instead of embedding
 * full artifact payloads.
 */
export class EvidenceWorkspace extends Schema.Class<EvidenceWorkspace>(
  "EvidenceWorkspace"
)({
  contributions: Schema.Array(CapabilityContribution).pipe(
    Schema.mutable,
    Schema.maxItems(EVIDENCE_WORKSPACE_CONTRIBUTION_LIMIT)
  ),
  createdAt: Schema.Number.pipe(Schema.nonNegative()),
  turnId: Schema.NonEmptyString,
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

    if (!contribution.artifacts) {
      continue;
    }

    for (const artifact of contribution.artifacts) {
      if (artifactIds.has(artifact.id)) {
        return `Duplicate learning artifact id: ${artifact.id}.`;
      }
      artifactIds.add(artifact.id);
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
