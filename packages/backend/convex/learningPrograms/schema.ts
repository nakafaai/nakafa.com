import { graphContentIdValidator } from "@repo/backend/convex/contents/graph";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { CURRICULUM_LENS_SCOPE_VALUES } from "@repo/contents/_types/graph/schema";
import {
  COVERAGE_STATUS_VALUES,
  LEARNING_OBJECTIVE_VALUES,
  LEARNING_PLAN_ITEM_REASON_VALUES,
  LEARNING_PLAN_ITEM_STATUS_VALUES,
  LEARNING_PROGRAM_KIND_VALUES,
  PROGRAM_PROVIDER_KIND_VALUES,
  PROGRAM_SOURCE_TYPE_VALUES,
} from "@repo/contents/_types/program/schema";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

export const learningProgramKindValidator = literals(
  ...LEARNING_PROGRAM_KIND_VALUES
);
export const learningObjectiveValidator = literals(
  ...LEARNING_OBJECTIVE_VALUES
);
export const coverageStatusValidator = literals(...COVERAGE_STATUS_VALUES);
export const curriculumLensScopeValidator = literals(
  ...CURRICULUM_LENS_SCOPE_VALUES
);
export const programProviderKindValidator = literals(
  ...PROGRAM_PROVIDER_KIND_VALUES
);
export const programSourceTypeValidator = literals(
  ...PROGRAM_SOURCE_TYPE_VALUES
);
export const learningPlanItemReasonValidator = literals(
  ...LEARNING_PLAN_ITEM_REASON_VALUES
);
export const learningPlanItemStatusValidator = literals(
  ...LEARNING_PLAN_ITEM_STATUS_VALUES
);

export const programSourceInputValidator = v.object({
  label: v.string(),
  retrievedAt: v.string(),
  reviewAfter: v.optional(v.string()),
  type: programSourceTypeValidator,
  url: v.string(),
});

export const learningProgramInputValidator = v.object({
  defaultCoverageStatus: coverageStatusValidator,
  description: v.string(),
  displayOrder: v.number(),
  key: v.string(),
  kind: learningProgramKindValidator,
  locale: localeValidator,
  provider: v.object({
    country: v.optional(v.string()),
    kind: programProviderKindValidator,
    name: v.string(),
  }),
  recommendedCountry: v.optional(v.string()),
  sources: v.array(programSourceInputValidator),
  title: v.string(),
  version: v.object({
    label: v.string(),
    startsAt: v.optional(v.string()),
    endsAt: v.optional(v.string()),
  }),
});

export const learningProgramCoverageInputValidator = v.object({
  contentCount: v.number(),
  coverageStatus: coverageStatusValidator,
  lensId: v.string(),
  lensScope: curriculumLensScopeValidator,
  locale: localeValidator,
  programKey: v.string(),
  sampleContentId: graphContentIdValidator,
  syncedAt: v.number(),
});

export const learningProgramSummaryValidator = v.object({
  coverageStatus: coverageStatusValidator,
  description: v.string(),
  displayOrder: v.number(),
  key: v.string(),
  kind: learningProgramKindValidator,
  locale: localeValidator,
  title: v.string(),
  versionLabel: v.string(),
});

export const activeLearningProfileValidator = v.union(
  v.null(),
  v.object({
    objective: learningObjectiveValidator,
    planItems: v.array(
      v.object({
        content_id: graphContentIdValidator,
        lensId: v.string(),
        position: v.number(),
        reason: learningPlanItemReasonValidator,
        route: v.optional(v.string()),
        status: learningPlanItemStatusValidator,
        title: v.optional(v.string()),
      })
    ),
    program: learningProgramSummaryValidator,
    stage: v.optional(v.string()),
  })
);

const tables = {
  learningPrograms: defineTable({
    defaultCoverageStatus: coverageStatusValidator,
    description: v.string(),
    displayOrder: v.number(),
    key: v.string(),
    kind: learningProgramKindValidator,
    locale: localeValidator,
    providerCountry: v.optional(v.string()),
    providerKind: programProviderKindValidator,
    providerName: v.string(),
    recommendedCountry: v.optional(v.string()),
    syncedAt: v.number(),
    title: v.string(),
    updatedAt: v.number(),
    versionEndsAt: v.optional(v.string()),
    versionLabel: v.string(),
    versionStartsAt: v.optional(v.string()),
  })
    .index("by_key", ["key"])
    .index("by_displayOrder", ["displayOrder"])
    .index("by_locale_and_displayOrder", ["locale", "displayOrder"]),

  learningProgramSources: defineTable({
    label: v.string(),
    programId: v.id("learningPrograms"),
    retrievedAt: v.string(),
    reviewAfter: v.optional(v.string()),
    syncedAt: v.number(),
    type: programSourceTypeValidator,
    url: v.string(),
  })
    .index("by_programId", ["programId"])
    .index("by_programId_and_url", ["programId", "url"]),

  learningProgramCoverage: defineTable({
    contentCount: v.number(),
    coverageStatus: coverageStatusValidator,
    lensId: v.string(),
    lensScope: curriculumLensScopeValidator,
    locale: localeValidator,
    programId: v.id("learningPrograms"),
    sampleContentId: graphContentIdValidator,
    syncedAt: v.number(),
  })
    .index("by_programId_and_locale_and_lensId", [
      "programId",
      "locale",
      "lensId",
    ])
    .index("by_programId_and_locale_and_coverageStatus", [
      "programId",
      "locale",
      "coverageStatus",
    ]),

  learningProfiles: defineTable({
    activePlanId: v.optional(v.id("learningPlans")),
    locale: localeValidator,
    objective: learningObjectiveValidator,
    programId: v.id("learningPrograms"),
    stage: v.optional(v.string()),
    updatedAt: v.number(),
    userId: v.id("users"),
  }).index("by_userId", ["userId"]),

  learningPlans: defineTable({
    createdAt: v.number(),
    profileId: v.id("learningProfiles"),
    programId: v.id("learningPrograms"),
    status: literals("active", "archived", "superseded"),
    updatedAt: v.number(),
    userId: v.id("users"),
    version: v.number(),
  })
    .index("by_profileId_and_status", ["profileId", "status"])
    .index("by_userId_and_status", ["userId", "status"]),

  learningPlanItems: defineTable({
    content_id: graphContentIdValidator,
    coverageStatus: coverageStatusValidator,
    createdAt: v.number(),
    lensId: v.string(),
    lensScope: curriculumLensScopeValidator,
    planId: v.id("learningPlans"),
    position: v.number(),
    programId: v.id("learningPrograms"),
    reason: learningPlanItemReasonValidator,
    route: v.optional(v.string()),
    status: learningPlanItemStatusValidator,
    title: v.optional(v.string()),
    updatedAt: v.number(),
    userId: v.id("users"),
  }).index("by_planId_and_position", ["planId", "position"]),
};

export default tables;
