import { Schema } from "effect";

type SchemaType<T extends Schema.Schema.Any> = Schema.Schema.Type<T>;

const CONCEPT_KEY_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const SKILL_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CONCEPT_DOMAIN_VALUES = [
  "mathematics",
  "science",
  "language",
  "social-studies",
  "reasoning",
] as const;

export const ConceptDomainSchema = Schema.Literal(...CONCEPT_DOMAIN_VALUES);

export type ConceptDomain = SchemaType<typeof ConceptDomainSchema>;

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

/** Stable skill key attached to one canonical concept. */
export const ConceptSkillKeySchema = Schema.String.pipe(
  Schema.pattern(SKILL_KEY_PATTERN, {
    identifier: "ConceptSkillKey",
    description: "Lowercase kebab-case concept skill key.",
    message: () => "Invalid concept skill key. Expected lowercase kebab-case.",
  }),
  Schema.brand("@Nakafa/ConceptSkillKey")
);

export type ConceptSkillKey = SchemaType<typeof ConceptSkillKeySchema>;

export const ConceptTranslationSchema = Schema.Struct({
  title: Schema.String,
});

export const ConceptTranslationsSchema = Schema.Struct({
  en: ConceptTranslationSchema,
  id: ConceptTranslationSchema,
});

/**
 * Source-registry concept row for Nakafa's language-neutral knowledge graph.
 *
 * Localized MDX assets may explain a concept in many languages, while official
 * curricula map to these canonical concepts through outcome alignments.
 */
export const ConceptSchema = Schema.Struct({
  domain: ConceptDomainSchema,
  key: ConceptKeySchema,
  prerequisites: Schema.Array(ConceptKeySchema),
  skills: Schema.Array(ConceptSkillKeySchema),
  translations: ConceptTranslationsSchema,
});

export type Concept = SchemaType<typeof ConceptSchema>;
