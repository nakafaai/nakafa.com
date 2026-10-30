import type { LearningCapabilityName } from "@repo/backend/confect/nina/capability/spec";

/** The copy of a limit that says how many links a capability reads at a time. */
const SOURCE_LIMIT = "activity.source-limit";

/**
 * The limit copy of each capability. Nakafa's links and the web sources both
 * answer the limit outcome with that copy, because each capability sends at
 * most `researchMaxSources` links. A capability that never answers with the
 * limit names `null`, so its activity shows the plain outcome label and never
 * another capability's wording. The record names every capability, so a new
 * one does not compile until it has its entry.
 */
const limitCopy = {
  nakafa: SOURCE_LIMIT,
  deepResearch: SOURCE_LIMIT,
  math: null,
  memory: null,
  calendar: null,
} satisfies Record<LearningCapabilityName, typeof SOURCE_LIMIT | null>;

/**
 * The copy key of the limit that an activity of this capability shows, or
 * `null` when the capability has none of its own. An unknown capability has
 * none either.
 */
export function readLimitCopy(capability: LearningCapabilityName | "unknown") {
  return capability === "unknown" ? null : limitCopy[capability];
}
