import { Schema } from "effect";

const LEARNING_CAPABILITY_NAME_VALUES = [
  "nakafa",
  "deepResearch",
  "math",
  "memory",
] as const;
/**
 * Schema-owned names for Nina's internal education capabilities. The browser
 * reads this list to name an activity, so the module holds no runner. The
 * registry (`registry.ts`) lists the capability behind each name, and the
 * compiler rejects a name without one.
 */
export const LearningCapabilityNameSchema = Schema.Literals(
  LEARNING_CAPABILITY_NAME_VALUES
);
export type LearningCapabilityName = typeof LearningCapabilityNameSchema.Type;
