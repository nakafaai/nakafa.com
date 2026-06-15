import { DateOnlySchema } from "@repo/contents/_shared/date";
import { Schema } from "effect";

type SchemaType<T extends Schema.Schema.Any> = Schema.Schema.Type<T>;

const CONCEPT_KEY_PATTERN = /^concept:[a-z0-9]+(?::[a-z0-9]+(?:-[a-z0-9]+)*)+$/;

/** Canonical language-neutral concept key derived from graph-owned content identity. */
export const ConceptKeySchema = Schema.String.pipe(
  Schema.pattern(CONCEPT_KEY_PATTERN, {
    identifier: "ConceptKey",
    description:
      "Colon-delimited graph concept ID with lowercase kebab segments.",
    message: () => "Invalid concept key. Expected a graph concept ID.",
  }),
  Schema.brand("@Nakafa/ConceptKey")
);

export type ConceptKey = SchemaType<typeof ConceptKeySchema>;

export const ConceptReferenceSchema = Schema.Struct({
  evidence: Schema.String,
  outcomeKey: Schema.String,
  reviewedAt: DateOnlySchema,
});

export type ConceptReference = SchemaType<typeof ConceptReferenceSchema>;

/**
 * Derived concept row for Nakafa's language-neutral alignment graph.
 *
 * Concepts are not a standalone curriculum source. They are materialized from
 * reviewed outcome alignments, then used as locale-neutral join keys between
 * assets and program outcomes.
 */
export const ConceptSchema = Schema.Struct({
  key: ConceptKeySchema,
  references: Schema.NonEmptyArray(ConceptReferenceSchema),
});

export type Concept = SchemaType<typeof ConceptSchema>;
