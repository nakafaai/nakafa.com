import { ConceptKeySchema } from "@repo/contents/_types/concept/schema";
import {
  LearningProgramKeySchema,
  ProgramDateOnlySchema,
  ProgramNavigationLevelSchema,
  ProgramSourceSchema,
  ProgramTranslationsSchema,
} from "@repo/contents/_types/program/schema";
import { Schema } from "effect";

type SchemaType<T extends Schema.Schema.Any> = Schema.Schema.Type<T>;

const OUTCOME_KEY_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const OUTLINE_NODE_KEY_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

export const OUTCOME_STATUS_VALUES = ["active", "planned", "retired"] as const;

export const OutcomeStatusSchema = Schema.Literal(...OUTCOME_STATUS_VALUES);

export type OutcomeStatus = SchemaType<typeof OutcomeStatusSchema>;

export const OUTCOME_CONCEPT_RELATION_VALUES = [
  "covers",
  "supports",
  "requires",
] as const;

export const OutcomeConceptRelationSchema = Schema.Literal(
  ...OUTCOME_CONCEPT_RELATION_VALUES
);

export type OutcomeConceptRelation = SchemaType<
  typeof OutcomeConceptRelationSchema
>;

/** Canonical official standard or curriculum outcome key. */
export const OutcomeKeySchema = Schema.String.pipe(
  Schema.pattern(OUTCOME_KEY_PATTERN, {
    identifier: "OutcomeKey",
    description: "Lowercase dot/kebab official outcome key.",
    message: () =>
      "Invalid outcome key. Expected lowercase dot/kebab segments.",
  }),
  Schema.brand("@Nakafa/OutcomeKey")
);

export type OutcomeKey = SchemaType<typeof OutcomeKeySchema>;

/** Stable program outline node key independent of route or folder paths. */
export const ProgramOutlineNodeKeySchema = Schema.String.pipe(
  Schema.pattern(OUTLINE_NODE_KEY_PATTERN, {
    identifier: "ProgramOutlineNodeKey",
    description: "Lowercase dot/kebab program outline node key.",
    message: () =>
      "Invalid program outline node key. Expected lowercase dot/kebab segments.",
  }),
  Schema.brand("@Nakafa/ProgramOutlineNodeKey")
);

export type ProgramOutlineNodeKey = SchemaType<
  typeof ProgramOutlineNodeKeySchema
>;

/**
 * Source-registry outline node for rendering one curriculum or exam hierarchy.
 *
 * Outline nodes describe the official/program navigation tree, not content
 * routes. Different programs can use class/subject/topic, course/unit/lesson,
 * exam section/domain, or track/topic without changing app identity.
 */
export const ProgramOutlineNodeSchema = Schema.Struct({
  displayOrder: Schema.Number,
  key: ProgramOutlineNodeKeySchema,
  level: ProgramNavigationLevelSchema,
  parentKey: Schema.optional(ProgramOutlineNodeKeySchema),
  programKey: LearningProgramKeySchema,
  translations: ProgramTranslationsSchema,
});

export type ProgramOutlineNode = SchemaType<typeof ProgramOutlineNodeSchema>;

/**
 * Official or Nakafa-authored learning outcome attached to one program outline.
 *
 * Outcomes are source-cited and versioned so coverage can evolve from broad
 * graph selectors to official standards without per-content curriculum maps.
 */
export const LearningOutcomeSchema = Schema.Struct({
  code: Schema.String,
  key: OutcomeKeySchema,
  outlineKey: ProgramOutlineNodeKeySchema,
  programKey: LearningProgramKeySchema,
  source: ProgramSourceSchema,
  status: OutcomeStatusSchema,
  translations: ProgramTranslationsSchema,
  versionLabel: Schema.String,
});

export type LearningOutcome = SchemaType<typeof LearningOutcomeSchema>;

/**
 * Evidence-backed mapping between one official outcome and Nakafa concepts.
 *
 * This is the scale seam: content assets map to concepts, outcomes map to
 * concepts, and sync can derive coverage without per-locale content maps.
 */
export const OutcomeConceptAlignmentSchema = Schema.Struct({
  conceptKey: ConceptKeySchema,
  evidence: Schema.String,
  outcomeKey: OutcomeKeySchema,
  relation: OutcomeConceptRelationSchema,
  reviewedAt: ProgramDateOnlySchema,
});

export type OutcomeConceptAlignment = SchemaType<
  typeof OutcomeConceptAlignmentSchema
>;
