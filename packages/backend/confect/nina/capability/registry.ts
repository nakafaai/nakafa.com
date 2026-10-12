import type { Capability } from "@repo/backend/confect/nina/capability/define";
import type { LearningCapabilityName } from "@repo/backend/confect/nina/capability/spec";
import { mathCapability } from "@repo/backend/confect/nina/math/capability";
import { memoryCapability } from "@repo/backend/confect/nina/memory/capability";
import { nakafaCapability } from "@repo/backend/confect/nina/nakafa/capability";
import { researchCapability } from "@repo/backend/confect/nina/research/capability";

/**
 * Every capability Nina has, under the name the model calls it by. The tools she
 * is offered, her tool policy, and the policy of each call are all built from
 * this one record. The order is the order of the tool list, of the tool policy
 * and of the sections that describe them, so it is part of the prompt prefix that
 * the provider caches: a new capability goes last.
 *
 * `LearningCapabilityName` is the list of names the browser reads without
 * loading any runner. The compiler holds the two together: a name without an
 * entry here, or an entry under another name, does not compile.
 */
export const registry = {
  nakafa: nakafaCapability,
  deepResearch: researchCapability,
  math: mathCapability,
  memory: memoryCapability,
} satisfies Record<LearningCapabilityName, Capability>;
