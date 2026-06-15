import {
  type Concept,
  ConceptSchema,
} from "@repo/contents/_types/concept/schema";
import conceptSource from "@repo/contents/_types/concept/source.json";
import { Schema } from "effect";

/**
 * Decoded source registry of Nakafa canonical concepts used by outcome mappings.
 *
 * The authoring surface is `source.json`, which can be hand-reviewed or
 * generated from an importer. This module owns the Effect Schema decode and
 * lookup/reference checks, not a giant implementation array.
 */
export const CONCEPT_REGISTRY = Schema.decodeUnknownSync(
  Schema.Array(ConceptSchema)
)(conceptSource);

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
