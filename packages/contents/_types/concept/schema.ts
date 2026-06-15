import { DateOnlySchema } from "@repo/contents/_shared/date";
import { Schema } from "effect";

type SchemaType<T extends Schema.Schema.Any> = Schema.Schema.Type<T>;

const CONCEPT_KEY_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

/** Canonical language-neutral Nakafa concept key. */
export const ConceptKeySchema = Schema.String.pipe(
  Schema.pattern(CONCEPT_KEY_PATTERN, {
    identifier: "ConceptKey",
    description: "Lowercase dot/kebab canonical Nakafa concept key.",
    message: () =>
      "Invalid concept key. Expected lowercase dot/kebab segments.",
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
