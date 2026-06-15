import type {
  LearningOutcome,
  ProgramOutcomeSource,
  ProgramOutlineNode,
} from "@repo/contents/_types/outcome/schema";
import { ProgramOutcomeSourceSchema } from "@repo/contents/_types/outcome/schema";
import { Schema } from "effect";

/**
 * Source-controlled program outline nodes keyed by canonical program identity.
 *
 * The authoring surface is typed TS source data that can be generated from an
 * official import job. This module exposes decoded rows only.
 */
export const PROGRAM_OUTCOME_SOURCES = Schema.decodeUnknownSync(
  Schema.Array(ProgramOutcomeSourceSchema)
)([]);

export const OUTCOME_REGISTRY = createOutcomeRegistry(PROGRAM_OUTCOME_SOURCES);

export const PROGRAM_OUTLINE_NODES = OUTCOME_REGISTRY.outlineNodes;

/** Source-cited official and Nakafa-authored outcome rows decoded from source data. */
export const LEARNING_OUTCOMES = OUTCOME_REGISTRY.outcomes;

/** Concept alignment rows that connect outcomes to Nakafa graph concepts. */
export const OUTCOME_CONCEPT_ALIGNMENTS = OUTCOME_REGISTRY.conceptAlignments;

/** Flattens program-owned outcome source modules into the sync/read registry. */
export function createOutcomeRegistry(
  sources: readonly ProgramOutcomeSource[]
) {
  return {
    conceptAlignments: sources.flatMap((source) => source.conceptAlignments),
    outcomes: sources.flatMap((source) => source.outcomes),
    outlineNodes: sources.flatMap((source) => source.outlineNodes),
    issues: getOutcomeSourceOwnershipIssues(sources),
  };
}

/** Finds one source-registry outcome by key. */
export function findLearningOutcomeByKey(
  key: string,
  outcomes: readonly LearningOutcome[] = LEARNING_OUTCOMES
) {
  return outcomes.find((outcome) => outcome.key === key) ?? null;
}

/** Finds one program outline node by key. */
export function findProgramOutlineNodeByKey(
  key: string,
  outlineNodes: readonly ProgramOutlineNode[] = PROGRAM_OUTLINE_NODES
) {
  return outlineNodes.find((node) => node.key === key) ?? null;
}

/** Reports rows that escaped their owning program source module. */
export function getOutcomeSourceOwnershipIssues(
  sources: readonly ProgramOutcomeSource[]
) {
  const issues: string[] = [];

  for (const source of sources) {
    for (const node of source.outlineNodes) {
      if (node.programKey !== source.programKey) {
        issues.push(
          `Outline ${node.key} belongs to ${node.programKey}, not source ${source.programKey}`
        );
      }
    }

    for (const outcome of source.outcomes) {
      if (outcome.programKey !== source.programKey) {
        issues.push(
          `Outcome ${outcome.key} belongs to ${outcome.programKey}, not source ${source.programKey}`
        );
      }
    }

    issues.push(...getAlignmentOwnershipIssues(source));
  }

  return issues;
}

function getAlignmentOwnershipIssues(source: ProgramOutcomeSource) {
  const issues: string[] = [];
  const sourceOutcomeKeys = new Set(
    source.outcomes.map((outcome) => outcome.key)
  );

  for (const alignment of source.conceptAlignments) {
    if (!sourceOutcomeKeys.has(alignment.outcomeKey)) {
      issues.push(
        `Alignment for ${alignment.conceptKey} references ${alignment.outcomeKey}, which is outside source ${source.programKey}`
      );
    }
  }

  return issues;
}
