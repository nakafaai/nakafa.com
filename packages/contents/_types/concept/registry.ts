import type { Concept } from "@repo/contents/_types/concept/schema";
import { CONCEPT_SOURCE } from "@repo/contents/_types/concept/source";

/**
 * Decoded source registry of Nakafa canonical concepts used by outcome mappings.
 *
 * The authoring surface is typed TS source data that can be hand-reviewed or
 * generated from an importer. This module owns lookup/reference checks so
 * curriculum imports do not turn into per-MDX membership tags.
 */
export const CONCEPT_REGISTRY = CONCEPT_SOURCE;

/** Finds one canonical concept row by key. */
export function findConceptByKey(
  key: string,
  concepts: readonly Concept[] = CONCEPT_REGISTRY
) {
  return concepts.find((concept) => concept.key === key) ?? null;
}

/** Reports concept registry references that cannot be resolved locally. */
export function getConceptRegistryIssues(
  concepts: readonly Concept[] = CONCEPT_REGISTRY
) {
  const keys = new Set(concepts.map((concept) => concept.key));
  const issues: string[] = [];

  for (const concept of concepts) {
    for (const prerequisite of concept.prerequisites) {
      if (!keys.has(prerequisite)) {
        issues.push(
          `Unknown prerequisite concept key: ${prerequisite} for ${concept.key}`
        );
      }
    }
  }

  return issues;
}
