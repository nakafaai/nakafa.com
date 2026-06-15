import type { Concept } from "@repo/contents/_types/concept/schema";
import { ConceptSchema } from "@repo/contents/_types/concept/schema";
import { OUTCOME_CONCEPT_ALIGNMENTS } from "@repo/contents/_types/outcome/registry";
import type { OutcomeConceptAlignment } from "@repo/contents/_types/outcome/schema";
import { Schema } from "effect";

interface ConceptReferenceInput {
  evidence: string;
  outcomeKey: string;
  reviewedAt: OutcomeConceptAlignment["reviewedAt"];
}

/**
 * Derived registry of canonical concepts used by outcome mappings.
 *
 * The curriculum source of truth is the program/outcome/outline source Module.
 * This Module derives concept rows from reviewed outcome alignments so concept
 * keys do not become arbitrary handwritten curriculum facts.
 */
export const CONCEPT_REGISTRY = createConceptRegistryFromOutcomeAlignments(
  OUTCOME_CONCEPT_ALIGNMENTS
);

/** Derives locale-neutral concept rows from reviewed outcome-to-concept alignments. */
export function createConceptRegistryFromOutcomeAlignments(
  alignments: readonly OutcomeConceptAlignment[]
) {
  const referencesByConcept = new Map<string, ConceptReferenceInput[]>();

  for (const alignment of alignments) {
    const references = referencesByConcept.get(alignment.conceptKey) ?? [];

    references.push({
      evidence: alignment.evidence,
      outcomeKey: alignment.outcomeKey,
      reviewedAt: alignment.reviewedAt,
    });
    referencesByConcept.set(alignment.conceptKey, references);
  }

  const rows = [...referencesByConcept.entries()].map(([key, references]) => ({
    key,
    references: [...references].sort((left, right) =>
      left.outcomeKey.localeCompare(right.outcomeKey)
    ),
  }));

  return Schema.decodeUnknownSync(Schema.Array(ConceptSchema))(
    rows.sort((left, right) => left.key.localeCompare(right.key))
  );
}

/** Finds one canonical concept row by key. */
export function findConceptByKey(
  key: string,
  concepts: readonly Concept[] = CONCEPT_REGISTRY
) {
  return concepts.find((concept) => concept.key === key) ?? null;
}

/** Reports duplicate derived concept references that would blur alignment provenance. */
export function getConceptRegistryIssues(
  concepts: readonly Concept[] = CONCEPT_REGISTRY
) {
  const issues: string[] = [];

  for (const concept of concepts) {
    const referencedOutcomes = new Set<string>();

    for (const reference of concept.references) {
      if (referencedOutcomes.has(reference.outcomeKey)) {
        issues.push(
          `Duplicate outcome reference: ${reference.outcomeKey} for concept ${concept.key}`
        );
        continue;
      }

      referencedOutcomes.add(reference.outcomeKey);
    }
  }

  return issues;
}
