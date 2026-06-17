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

const coverageStatusValidator = literals(...COVERAGE_STATUS_VALUES);
const curriculumKindValidator = literals(...LEARNING_PROGRAM_KIND_VALUES);
const providerKindValidator = literals(...PROGRAM_PROVIDER_KIND_VALUES);
const sourceTypeValidator = literals(...PROGRAM_SOURCE_TYPE_VALUES);
const navigationLevelValidator = literals(...PROGRAM_NAVIGATION_LEVEL_VALUES);
const navigationModelValidator = literals(...PROGRAM_NAVIGATION_MODEL_VALUES);

const localizedLabelValidator = v.object({
  description: v.optional(v.string()),
  routeSlug: v.string(),
  title: v.string(),
});

const localizedProgramLabelValidator = v.object({
  description: v.string(),
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
  /** Canonical curriculum/program identity and localized display copy. */
  curricula: defineTable({
    defaultCoverageStatus: coverageStatusValidator,
    displayOrder: v.number(),
    key: v.string(),
    kind: curriculumKindValidator,
    navigation: navigationValidator,
    providerCountry: v.optional(v.string()),
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

  /** Curriculum-owned outline/navigation node. */
  curriculumNodes: defineTable({
    curriculumKey: v.string(),
    displayOrder: v.number(),
    key: v.string(),
    level: navigationLevelValidator,
    parentKey: v.optional(v.string()),
    syncedAt: v.number(),
    translations: v.object({
      en: localizedLabelValidator,
      id: localizedLabelValidator,
    }),
    updatedAt: v.number(),
  })
    .index("by_curriculumKey_and_key", ["curriculumKey", "key"])
    .index("by_curriculumKey_and_parentKey_and_displayOrder", [
      "curriculumKey",
      "parentKey",
      "displayOrder",
    ])
    .index("by_syncedAt", ["syncedAt"]),

  /** Ordered curriculum-to-material mapping. */
  curriculumMaterials: defineTable({
    curriculumKey: v.string(),
    materialKey: v.string(),
    nodeKey: v.string(),
    order: v.number(),
    syncedAt: v.number(),
  })
    .index("by_curriculumKey_and_nodeKey_and_order", [
      "curriculumKey",
      "nodeKey",
      "order",
    ])
    .index("by_curriculumKey_and_nodeKey_and_materialKey", [
      "curriculumKey",
      "nodeKey",
      "materialKey",
    ])
    .index("by_materialKey", ["materialKey"])
    .index("by_syncedAt", ["syncedAt"]),
};

export default tables;
