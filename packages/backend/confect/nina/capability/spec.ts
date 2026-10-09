import { Schema } from "effect";

const LEARNING_CAPABILITY_NAME_VALUES = [
  "nakafa",
  "deepResearch",
  "math",
] as const;
/** Schema-owned names for Nina's internal education capabilities. */
export const LearningCapabilityNameSchema = Schema.Literals(
  LEARNING_CAPABILITY_NAME_VALUES
);
export type LearningCapabilityName = typeof LearningCapabilityNameSchema.Type;
export const NAKAFA_CAPABILITY = "nakafa" satisfies LearningCapabilityName;
export const RESEARCH_CAPABILITY =
  "deepResearch" satisfies LearningCapabilityName;
export const MATH_CAPABILITY = "math" satisfies LearningCapabilityName;
