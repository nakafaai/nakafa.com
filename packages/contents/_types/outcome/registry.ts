import {
  type LearningOutcome,
  LearningOutcomeSchema,
  OutcomeConceptAlignmentSchema,
  type ProgramOutlineNode,
  ProgramOutlineNodeSchema,
} from "@repo/contents/_types/outcome/schema";
import outcomeSource from "@repo/contents/_types/outcome/source.json";
import { Schema } from "effect";

const OutcomeSourceSchema = Schema.Struct({
  conceptAlignments: Schema.Array(OutcomeConceptAlignmentSchema),
  outcomes: Schema.Array(LearningOutcomeSchema),
  outlineNodes: Schema.Array(ProgramOutlineNodeSchema),
});

const decodedSource =
  Schema.decodeUnknownSync(OutcomeSourceSchema)(outcomeSource);

/**
 * Source-controlled program outline nodes keyed by canonical program identity.
 *
 * The authoring surface is `source.json`, which can be generated from an
 * official import job. This module validates and exposes decoded rows only.
 */
export const PROGRAM_OUTLINE_NODES = decodedSource.outlineNodes;

/** Source-cited official and Nakafa-authored outcome rows decoded from source data. */
export const LEARNING_OUTCOMES = decodedSource.outcomes;

/** Concept alignment rows that connect outcomes to Nakafa graph concepts. */
export const OUTCOME_CONCEPT_ALIGNMENTS = decodedSource.conceptAlignments;

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
