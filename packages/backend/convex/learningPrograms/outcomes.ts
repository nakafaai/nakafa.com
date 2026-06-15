import type {
  learningOutcomeInputValidator,
  outcomeConceptAlignmentInputValidator,
  programOutlineNodeInputValidator,
} from "@repo/backend/convex/learningPrograms/schema";
import {
  LEARNING_OUTCOMES,
  OUTCOME_CONCEPT_ALIGNMENTS,
  PROGRAM_OUTLINE_NODES,
} from "@repo/contents/_types/outcome/registry";
import type {
  LearningOutcome,
  OutcomeConceptAlignment,
  ProgramOutlineNode,
} from "@repo/contents/_types/outcome/schema";
import type { Infer } from "convex/values";

export type ProgramOutlineNodeSyncInput = Infer<
  typeof programOutlineNodeInputValidator
>;
export type LearningOutcomeSyncInput = Infer<
  typeof learningOutcomeInputValidator
>;
export type OutcomeConceptAlignmentSyncInput = Infer<
  typeof outcomeConceptAlignmentInputValidator
>;

/** Converts readonly contents outline contracts into Convex mutation input rows. */
export function getProgramOutlineNodeInputs(
  nodes: readonly ProgramOutlineNode[] = PROGRAM_OUTLINE_NODES
): ProgramOutlineNodeSyncInput[] {
  return nodes.map((node) => ({
    displayOrder: node.displayOrder,
    key: node.key,
    level: node.level,
    parentKey: node.parentKey,
    programKey: node.programKey,
    translations: { ...node.translations },
  }));
}

/** Converts readonly contents outcome contracts into Convex mutation input rows. */
export function getLearningOutcomeInputs(
  outcomes: readonly LearningOutcome[] = LEARNING_OUTCOMES
): LearningOutcomeSyncInput[] {
  return outcomes.map((outcome) => ({
    code: outcome.code,
    key: outcome.key,
    outlineKey: outcome.outlineKey,
    programKey: outcome.programKey,
    source: { ...outcome.source },
    status: outcome.status,
    translations: { ...outcome.translations },
    versionLabel: outcome.versionLabel,
  }));
}

/** Converts readonly contents outcome/concept mappings into Convex mutation input rows. */
export function getOutcomeConceptAlignmentInputs(
  alignments: readonly OutcomeConceptAlignment[] = OUTCOME_CONCEPT_ALIGNMENTS
): OutcomeConceptAlignmentSyncInput[] {
  return alignments.map((alignment) => ({ ...alignment }));
}
