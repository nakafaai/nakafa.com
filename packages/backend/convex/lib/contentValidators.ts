/**
 * Shared validators for content storage schema.
 * These match Zod schemas in packages/contents/_types/.
 *
 * This is the SINGLE SOURCE OF TRUTH for content-related validators.
 * Import from here instead of duplicating in other schema files.
 */
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

/** Supported content languages */
export const localeValidator = literals("en", "id");
export type Locale = Infer<typeof localeValidator>;

/** Discriminator for polymorphic content references (used in contentAuthors join table) */
export const contentTypeValidator = literals("article", "subject", "exercise");
export type ContentType = Infer<typeof contentTypeValidator>;

export const articleCategoryValidator = literals("politics");
export type ArticleCategory = Infer<typeof articleCategoryValidator>;

/** Subject categories (also used in chats for tools) */
export const subjectCategoryValidator = literals(
  "elementary-school",
  "middle-school",
  "high-school",
  "university"
);
export type SubjectCategory = Infer<typeof subjectCategoryValidator>;

/** School grades (1-12) and university levels */
export const gradeValidator = literals(
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "bachelor",
  "master",
  "phd"
);
export type Grade = Infer<typeof gradeValidator>;

/** Subject materials (high school + university) */
export const materialValidator = literals(
  "mathematics",
  "physics",
  "chemistry",
  "biology",
  "geography",
  "economy",
  "history",
  "informatics",
  "geospatial",
  "sociology",
  "ai-ds",
  "game-engineering",
  "computer-science",
  "technology-electro-medical",
  "political-science",
  "informatics-engineering",
  "international-relations"
);
export type Material = Infer<typeof materialValidator>;

export const exercisesCategoryValidator = literals(
  "high-school",
  "middle-school"
);
export type ExercisesCategory = Infer<typeof exercisesCategoryValidator>;

/** Exam types: grade-9 (SMP), tka (old format), snbt (new format) */
export const exercisesTypeValidator = literals("grade-9", "tka", "snbt");
export type ExercisesType = Infer<typeof exercisesTypeValidator>;

/** Exercise-specific materials (differs from subject materials) */
export const exercisesMaterialValidator = literals(
  "mathematics",
  "quantitative-knowledge",
  "mathematical-reasoning",
  "general-reasoning",
  "indonesian-language",
  "english-language",
  "general-knowledge",
  "reading-and-writing-skills"
);
export type ExercisesMaterial = Infer<typeof exercisesMaterialValidator>;

/** Audio generation status for contentAudios - uses kebab-case convention */
export const audioStatusValidator = literals(
  "pending",
  "generating-script",
  "generating-speech",
  "completed",
  "failed"
);
export type AudioStatus = Infer<typeof audioStatusValidator>;

/** Voice settings for ElevenLabs - matches API exactly
 * @see https://elevenlabs.io/docs/api-reference/text-to-speech/convert
 *
 * Note: This validator is NOT wrapped in v.optional().
 * Consumers should wrap it if the field is optional in their schema.
 */
export const voiceSettingsValidator = v.object({
  stability: v.optional(v.number()),
  similarityBoost: v.optional(v.number()),
  style: v.optional(v.number()),
  useSpeakerBoost: v.optional(v.boolean()),
});
export type VoiceSettings = Infer<typeof voiceSettingsValidator>;
