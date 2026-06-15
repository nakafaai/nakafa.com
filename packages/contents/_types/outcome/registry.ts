import type {
  LearningOutcome,
  ProgramOutlineNode,
} from "@repo/contents/_types/outcome/schema";
import { OUTCOME_SOURCE } from "@repo/contents/_types/outcome/source";

/**
 * Source-controlled program outline nodes keyed by canonical program identity.
 *
 * The authoring surface is typed TS source data that can be generated from an
 * official import job. This module exposes decoded rows only.
 */
export const PROGRAM_OUTLINE_NODES = OUTCOME_SOURCE.outlineNodes;

/** Source-cited official and Nakafa-authored outcome rows decoded from source data. */
export const LEARNING_OUTCOMES = OUTCOME_SOURCE.outcomes;

/** Concept alignment rows that connect outcomes to Nakafa graph concepts. */
export const OUTCOME_CONCEPT_ALIGNMENTS = OUTCOME_SOURCE.conceptAlignments;

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
