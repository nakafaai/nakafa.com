import { CONCEPT_REGISTRY } from "@repo/contents/_types/concept/registry";
import type { Concept } from "@repo/contents/_types/concept/schema";
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
import { LEARNING_PROGRAM_CATALOG } from "@repo/contents/_types/program/catalog";
import type { LearningProgram } from "@repo/contents/_types/program/schema";

/**
 * Reports invalid source-registry references across programs, outlines, outcomes, and concepts.
 *
 * This is the DX guardrail for global curricula: official outcomes can grow
 * without turning program catalog rows into manual route/content maps.
 */
export function getOutcomeRegistryIssues({
  alignments = OUTCOME_CONCEPT_ALIGNMENTS,
  concepts = CONCEPT_REGISTRY,
  outcomes = LEARNING_OUTCOMES,
  outlineNodes = PROGRAM_OUTLINE_NODES,
  programs = LEARNING_PROGRAM_CATALOG,
}: {
  alignments?: readonly OutcomeConceptAlignment[];
  concepts?: readonly Concept[];
  outcomes?: readonly LearningOutcome[];
  outlineNodes?: readonly ProgramOutlineNode[];
  programs?: readonly LearningProgram[];
} = {}) {
  const conceptKeys = new Set(concepts.map((concept) => concept.key));
  const outcomeKeys = new Set(outcomes.map((outcome) => outcome.key));
  const outlineKeys = new Set(outlineNodes.map((node) => node.key));
  const programKeys = new Set(programs.map((program) => program.key));
  const issues: string[] = [];

  for (const node of outlineNodes) {
    if (!programKeys.has(node.programKey)) {
      issues.push(
        `Unknown learning program key: ${node.programKey} for outline ${node.key}`
      );
    }

    if (node.parentKey && !outlineKeys.has(node.parentKey)) {
      issues.push(
        `Unknown parent outline key: ${node.parentKey} for outline ${node.key}`
      );
    }
  }

  for (const outcome of outcomes) {
    if (!programKeys.has(outcome.programKey)) {
      issues.push(
        `Unknown learning program key: ${outcome.programKey} for outcome ${outcome.key}`
      );
    }

    if (!outlineKeys.has(outcome.outlineKey)) {
      issues.push(
        `Unknown outline key: ${outcome.outlineKey} for outcome ${outcome.key}`
      );
    }
  }

  for (const alignment of alignments) {
    if (!outcomeKeys.has(alignment.outcomeKey)) {
      issues.push(
        `Unknown outcome key: ${alignment.outcomeKey} for concept ${alignment.conceptKey}`
      );
    }

    if (!conceptKeys.has(alignment.conceptKey)) {
      issues.push(
        `Unknown concept key: ${alignment.conceptKey} for outcome ${alignment.outcomeKey}`
      );
    }
  }

  return issues;
}
