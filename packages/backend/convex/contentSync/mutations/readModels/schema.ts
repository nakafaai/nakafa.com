import {
  localeValidator,
  materialValidator,
} from "@repo/backend/convex/lib/validators/contents";
import {
  COVERAGE_STATUS_VALUES,
  LEARNING_PROGRAM_KIND_VALUES,
  PROGRAM_NAVIGATION_LEVEL_VALUES,
  PROGRAM_NAVIGATION_MODEL_VALUES,
  PROGRAM_PROVIDER_KIND_VALUES,
  PROGRAM_SOURCE_TYPE_VALUES,
} from "@repo/contents/_types/program/schema";
import { PUBLIC_ROUTE_KIND_VALUES } from "@repo/contents/_types/route/schema";
import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";

export const syncSummaryValidator = v.object({
  created: v.number(),
  unchanged: v.number(),
  updated: v.number(),
});

export const deleteResultValidator = v.object({
  deleted: v.number(),
});

const materialKindValidator = literals("lesson", "practice");
const coverageStatusValidator = literals(...COVERAGE_STATUS_VALUES);
const programKindValidator = literals(...LEARNING_PROGRAM_KIND_VALUES);
const providerKindValidator = literals(...PROGRAM_PROVIDER_KIND_VALUES);
const sourceTypeValidator = literals(...PROGRAM_SOURCE_TYPE_VALUES);
const navigationLevelValidator = literals(...PROGRAM_NAVIGATION_LEVEL_VALUES);
const navigationModelValidator = literals(...PROGRAM_NAVIGATION_MODEL_VALUES);
const publicRouteKindValidator = literals(...PUBLIC_ROUTE_KIND_VALUES);

const materialConceptValidator = v.object({
  key: v.string(),
  source: literals("authored", "generated"),
});

const localizedMaterialMetadataValidator = v.object({
  description: v.optional(v.string()),
  title: v.string(),
});

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

export const materialRowValidator = v.object({
  concepts: v.array(materialConceptValidator),
  domain: v.string(),
  key: v.string(),
  kind: materialKindValidator,
  route: v.string(),
});

export const materialLocaleRowValidator = v.object({
  body: v.optional(v.string()),
  contentHash: v.optional(v.string()),
  date: v.optional(v.number()),
  locale: localeValidator,
  materialKey: v.string(),
  metadata: localizedMaterialMetadataValidator,
  route: v.string(),
  sectionKey: v.optional(v.string()),
});

export const generatedProgramRowValidator = v.object({
  defaultCoverageStatus: coverageStatusValidator,
  displayOrder: v.number(),
  key: v.string(),
  kind: programKindValidator,
  navigation: navigationValidator,
  providerCountry: v.optional(v.string()),
  providerKind: providerKindValidator,
  providerName: v.string(),
  recommendedCountry: v.optional(v.string()),
  sources: v.array(sourceCitationValidator),
  translations: v.object({
    en: localizedProgramLabelValidator,
    id: localizedProgramLabelValidator,
  }),
  versionEndsAt: v.optional(v.string()),
  versionLabel: v.string(),
  versionStartsAt: v.optional(v.string()),
});

export const curriculumNodeRowValidator = v.object({
  curriculumKey: v.string(),
  displayOrder: v.number(),
  key: v.string(),
  level: navigationLevelValidator,
  parentKey: v.optional(v.string()),
  translations: v.object({
    en: localizedLabelValidator,
    id: localizedLabelValidator,
  }),
});

export const curriculumMaterialRowValidator = v.object({
  curriculumKey: v.string(),
  materialKey: v.string(),
  nodeKey: v.string(),
  order: v.number(),
});

export const assessmentNodeRowValidator = v.object({
  assessmentKey: v.string(),
  displayOrder: v.number(),
  key: v.string(),
  level: navigationLevelValidator,
  materialKeys: v.array(v.string()),
  parentKey: v.optional(v.string()),
  translations: v.object({
    en: localizedLabelValidator,
    id: localizedLabelValidator,
  }),
});

export const publicRouteRowValidator = v.object({
  canonicalPath: v.optional(v.string()),
  description: v.optional(v.string()),
  kind: publicRouteKindValidator,
  locale: localeValidator,
  materialDomain: v.optional(materialValidator),
  materialKey: v.optional(v.string()),
  nodeKey: v.optional(v.string()),
  order: v.optional(v.number()),
  parentPath: v.optional(v.string()),
  programKey: v.optional(v.string()),
  publicPath: v.string(),
  sectionKey: v.optional(v.string()),
  sitemap: v.boolean(),
  sourcePath: v.optional(v.string()),
  title: v.string(),
});

export type PublicRouteRow = Infer<typeof publicRouteRowValidator>;
export type SyncedPublicRouteRow = PublicRouteRow & { syncedAt: number };
