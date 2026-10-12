import { Schema } from "effect";

/** The capability that reads the links to Nakafa's own site. */
export const NAKAFA_CAPABILITY = "nakafa";

/** The capability that reads the links to outside sites. */
export const RESEARCH_CAPABILITY = "deepResearch";

/** The capability that searches what the learner told Nina before. */
export const MEMORY_CAPABILITY = "memory";

const LEARNING_CAPABILITY_NAME_VALUES = [
  NAKAFA_CAPABILITY,
  RESEARCH_CAPABILITY,
  "math",
  MEMORY_CAPABILITY,
] as const;
/**
 * Schema-owned names for Nina's internal education capabilities. The browser
 * reads this list to name an activity, so the module holds no runner. The
 * registry (`registry.ts`) lists the capability behind each name, and the
 * compiler rejects a name without one. A name has a constant only where another
 * module reads it on its own, so each name is written once.
 */
export const LearningCapabilityNameSchema = Schema.Literals(
  LEARNING_CAPABILITY_NAME_VALUES
);
export type LearningCapabilityName = typeof LearningCapabilityNameSchema.Type;
