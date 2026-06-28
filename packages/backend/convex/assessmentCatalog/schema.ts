import {
  COVERAGE_STATUS_VALUES,
  LEARNING_PROGRAM_KIND_VALUES,
  PROGRAM_NAVIGATION_LEVEL_VALUES,
  PROGRAM_NAVIGATION_MODEL_VALUES,
  PROGRAM_PROVIDER_KIND_VALUES,
  PROGRAM_SOURCE_TYPE_VALUES,
} from "@repo/contents/_types/program/schema";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

const assessmentKindValidator = literals(...LEARNING_PROGRAM_KIND_VALUES);
const coverageStatusValidator = literals(...COVERAGE_STATUS_VALUES);
const navigationLevelValidator = literals(...PROGRAM_NAVIGATION_LEVEL_VALUES);
const navigationModelValidator = literals(...PROGRAM_NAVIGATION_MODEL_VALUES);
const providerKindValidator = literals(...PROGRAM_PROVIDER_KIND_VALUES);
const sourceTypeValidator = literals(...PROGRAM_SOURCE_TYPE_VALUES);

const localizedLabelValidator = v.object({
  description: v.optional(v.string()),
  routeSlug: v.string(),
  title: v.string(),
});

const localizedProgramLabelValidator = v.object({
  description: v.optional(v.string()),
  publicSlug: v.string(),
  title: v.string(),
});

const sourceCitationValidator = v.object({
  label: v.string(),
  retrievedAt: v.string(),
  reviewAfter: v.optional(v.string()),
  type: sourceTypeValidator,
  url: v.string(),
});

const navigationValidator = v.object({
  levels: v.array(navigationLevelValidator),
  model: navigationModelValidator,
});

const tables = {
  /** Canonical assessment/exam identity and localized display copy. */
  assessments: defineTable({
    defaultCoverageStatus: coverageStatusValidator,
    displayOrder: v.number(),
    key: v.string(),
    kind: assessmentKindValidator,
    navigation: navigationValidator,
    providerHomeCountry: v.optional(v.string()),
    providerKind: providerKindValidator,
    providerName: v.string(),
    recommendedCountry: v.optional(v.string()),
    sources: v.array(sourceCitationValidator),
    syncedAt: v.number(),
    translations: v.object({
      en: localizedProgramLabelValidator,
      id: localizedProgramLabelValidator,
    }),
    updatedAt: v.number(),
    versionEndsAt: v.optional(v.string()),
    versionLabel: v.string(),
    versionStartsAt: v.optional(v.string()),
  })
    .index("by_key", ["key"])
    .index("by_displayOrder", ["displayOrder"])
    .index("by_syncedAt", ["syncedAt"]),

  /** Assessment-owned outline/navigation node. */
  assessmentNodes: defineTable({
    assessmentKey: v.string(),
    displayOrder: v.number(),
    key: v.string(),
    level: navigationLevelValidator,
    materialKeys: v.array(v.string()),
    parentKey: v.optional(v.string()),
    syncedAt: v.number(),
    translations: v.object({
      en: localizedLabelValidator,
      id: localizedLabelValidator,
    }),
    updatedAt: v.number(),
  })
    .index("by_assessmentKey_and_key", ["assessmentKey", "key"])
    .index("by_assessmentKey_and_parentKey_and_displayOrder", [
      "assessmentKey",
      "parentKey",
      "displayOrder",
    ])
    .index("by_syncedAt", ["syncedAt"]),
};

export default tables;
