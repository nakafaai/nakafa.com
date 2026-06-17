import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import { internalMutation } from "@repo/backend/convex/functions";
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

const syncSummaryValidator = v.object({
  created: v.number(),
  unchanged: v.number(),
  updated: v.number(),
});

const deleteResultValidator = v.object({
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

const materialRowValidator = v.object({
  concepts: v.array(materialConceptValidator),
  domain: v.string(),
  key: v.string(),
  kind: materialKindValidator,
  route: v.string(),
});

const materialLocaleRowValidator = v.object({
  body: v.optional(v.string()),
  contentHash: v.optional(v.string()),
  date: v.optional(v.number()),
  locale: localeValidator,
  materialKey: v.string(),
  metadata: localizedMaterialMetadataValidator,
  route: v.string(),
  sectionKey: v.optional(v.string()),
});

const generatedProgramRowValidator = v.object({
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

const curriculumNodeRowValidator = v.object({
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

const curriculumMaterialRowValidator = v.object({
  curriculumKey: v.string(),
  materialKey: v.string(),
  nodeKey: v.string(),
  order: v.number(),
});

const assessmentNodeRowValidator = v.object({
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

const publicRouteRowValidator = v.object({
  canonicalPath: v.optional(v.string()),
  description: v.optional(v.string()),
  kind: publicRouteKindValidator,
  locale: localeValidator,
  materialDomain: v.optional(materialValidator),
  materialKey: v.optional(v.string()),
  nodeKey: v.optional(v.string()),
  parentPath: v.optional(v.string()),
  programKey: v.optional(v.string()),
  publicPath: v.string(),
  sectionKey: v.optional(v.string()),
  sitemap: v.boolean(),
  sourcePath: v.optional(v.string()),
  title: v.string(),
});
type PublicRouteRow = Infer<typeof publicRouteRowValidator>;
type SyncedPublicRouteRow = PublicRouteRow & { syncedAt: number };

/** Upserts curriculum-neutral material read models from typed material sources. */
export const bulkSyncMaterials = internalMutation({
  args: {
    materials: v.array(materialRowValidator),
    syncedAt: v.number(),
  },
  returns: syncSummaryValidator,
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncMaterials",
      limit: CONTENT_SYNC_BATCH_LIMITS.generatedMaterials,
      received: args.materials.length,
      unit: "materials",
    });

    const now = Date.now();
    let created = 0;
    let updated = 0;

    for (const material of args.materials) {
      const existing = await ctx.db
        .query("materials")
        .withIndex("by_key", (q) => q.eq("key", material.key))
        .unique();

      if (existing) {
        await ctx.db.patch("materials", existing._id, {
          ...material,
          syncedAt: args.syncedAt,
          updatedAt: now,
        });
        updated++;
        continue;
      }

      await ctx.db.insert("materials", {
        ...material,
        syncedAt: args.syncedAt,
        updatedAt: now,
      });
      created++;
    }

    return { created, unchanged: 0, updated };
  },
});

/** Upserts localized material asset read models from MDX and material sources. */
export const bulkSyncMaterialLocales = internalMutation({
  args: {
    locales: v.array(materialLocaleRowValidator),
    syncedAt: v.number(),
  },
  returns: syncSummaryValidator,
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncMaterialLocales",
      limit: CONTENT_SYNC_BATCH_LIMITS.generatedMaterialLocales,
      received: args.locales.length,
      unit: "material locales",
    });

    const now = Date.now();
    let created = 0;
    let updated = 0;

    for (const locale of args.locales) {
      const existing = await ctx.db
        .query("materialLocales")
        .withIndex("by_locale_and_materialKey_and_sectionKey", (q) =>
          q
            .eq("locale", locale.locale)
            .eq("materialKey", locale.materialKey)
            .eq("sectionKey", locale.sectionKey)
        )
        .unique();

      if (existing) {
        await ctx.db.patch("materialLocales", existing._id, {
          ...locale,
          syncedAt: args.syncedAt,
          updatedAt: now,
        });
        updated++;
        continue;
      }

      await ctx.db.insert("materialLocales", {
        ...locale,
        syncedAt: args.syncedAt,
        updatedAt: now,
      });
      created++;
    }

    return { created, unchanged: 0, updated };
  },
});

/** Upserts canonical curriculum/program identities into the final read model. */
export const bulkSyncCurricula = internalMutation({
  args: {
    curricula: v.array(generatedProgramRowValidator),
    syncedAt: v.number(),
  },
  returns: syncSummaryValidator,
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncCurricula",
      limit: CONTENT_SYNC_BATCH_LIMITS.generatedCurricula,
      received: args.curricula.length,
      unit: "curricula",
    });

    const now = Date.now();
    let created = 0;
    let updated = 0;

    for (const curriculum of args.curricula) {
      const existing = await ctx.db
        .query("curricula")
        .withIndex("by_key", (q) => q.eq("key", curriculum.key))
        .unique();

      if (existing) {
        await ctx.db.patch("curricula", existing._id, {
          ...curriculum,
          syncedAt: args.syncedAt,
          updatedAt: now,
        });
        updated++;
        continue;
      }

      await ctx.db.insert("curricula", {
        ...curriculum,
        syncedAt: args.syncedAt,
        updatedAt: now,
      });
      created++;
    }

    return { created, unchanged: 0, updated };
  },
});

/** Upserts curriculum-owned outline nodes into the final read model. */
export const bulkSyncCurriculumNodes = internalMutation({
  args: {
    nodes: v.array(curriculumNodeRowValidator),
    syncedAt: v.number(),
  },
  returns: syncSummaryValidator,
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncCurriculumNodes",
      limit: CONTENT_SYNC_BATCH_LIMITS.generatedCurriculumNodes,
      received: args.nodes.length,
      unit: "curriculum nodes",
    });

    const now = Date.now();
    let created = 0;
    let updated = 0;

    for (const node of args.nodes) {
      const existing = await ctx.db
        .query("curriculumNodes")
        .withIndex("by_curriculumKey_and_key", (q) =>
          q.eq("curriculumKey", node.curriculumKey).eq("key", node.key)
        )
        .unique();

      if (existing) {
        await ctx.db.patch("curriculumNodes", existing._id, {
          ...node,
          syncedAt: args.syncedAt,
          updatedAt: now,
        });
        updated++;
        continue;
      }

      await ctx.db.insert("curriculumNodes", {
        ...node,
        syncedAt: args.syncedAt,
        updatedAt: now,
      });
      created++;
    }

    return { created, unchanged: 0, updated };
  },
});

/** Upserts curriculum-to-material mappings into the final read model. */
export const bulkSyncCurriculumMaterials = internalMutation({
  args: {
    mappings: v.array(curriculumMaterialRowValidator),
    syncedAt: v.number(),
  },
  returns: syncSummaryValidator,
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncCurriculumMaterials",
      limit: CONTENT_SYNC_BATCH_LIMITS.generatedCurriculumMaterials,
      received: args.mappings.length,
      unit: "curriculum material mappings",
    });

    let created = 0;
    let updated = 0;

    for (const mapping of args.mappings) {
      const existing = await ctx.db
        .query("curriculumMaterials")
        .withIndex("by_curriculumKey_and_nodeKey_and_materialKey", (q) =>
          q
            .eq("curriculumKey", mapping.curriculumKey)
            .eq("nodeKey", mapping.nodeKey)
            .eq("materialKey", mapping.materialKey)
        )
        .unique();

      if (existing) {
        await ctx.db.patch("curriculumMaterials", existing._id, {
          ...mapping,
          syncedAt: args.syncedAt,
        });
        updated++;
        continue;
      }

      await ctx.db.insert("curriculumMaterials", {
        ...mapping,
        syncedAt: args.syncedAt,
      });
      created++;
    }

    return { created, unchanged: 0, updated };
  },
});

/** Upserts assessment/exam identities into the final read model. */
export const bulkSyncAssessments = internalMutation({
  args: {
    assessments: v.array(generatedProgramRowValidator),
    syncedAt: v.number(),
  },
  returns: syncSummaryValidator,
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncAssessments",
      limit: CONTENT_SYNC_BATCH_LIMITS.generatedAssessments,
      received: args.assessments.length,
      unit: "assessments",
    });

    const now = Date.now();
    let created = 0;
    let updated = 0;

    for (const assessment of args.assessments) {
      const existing = await ctx.db
        .query("assessments")
        .withIndex("by_key", (q) => q.eq("key", assessment.key))
        .unique();

      if (existing) {
        await ctx.db.patch("assessments", existing._id, {
          ...assessment,
          syncedAt: args.syncedAt,
          updatedAt: now,
        });
        updated++;
        continue;
      }

      await ctx.db.insert("assessments", {
        ...assessment,
        syncedAt: args.syncedAt,
        updatedAt: now,
      });
      created++;
    }

    return { created, unchanged: 0, updated };
  },
});

/** Upserts assessment-owned outline nodes into the final read model. */
export const bulkSyncAssessmentNodes = internalMutation({
  args: {
    nodes: v.array(assessmentNodeRowValidator),
    syncedAt: v.number(),
  },
  returns: syncSummaryValidator,
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncAssessmentNodes",
      limit: CONTENT_SYNC_BATCH_LIMITS.generatedAssessmentNodes,
      received: args.nodes.length,
      unit: "assessment nodes",
    });

    const now = Date.now();
    let created = 0;
    let updated = 0;

    for (const node of args.nodes) {
      const existing = await ctx.db
        .query("assessmentNodes")
        .withIndex("by_assessmentKey_and_key", (q) =>
          q.eq("assessmentKey", node.assessmentKey).eq("key", node.key)
        )
        .unique();

      if (existing) {
        await ctx.db.patch("assessmentNodes", existing._id, {
          ...node,
          syncedAt: args.syncedAt,
          updatedAt: now,
        });
        updated++;
        continue;
      }

      await ctx.db.insert("assessmentNodes", {
        ...node,
        syncedAt: args.syncedAt,
        updatedAt: now,
      });
      created++;
    }

    return { created, unchanged: 0, updated };
  },
});

/** Upserts source-owned public route rows for app, SEO, and agents. */
export const bulkSyncPublicRoutes = internalMutation({
  args: {
    routes: v.array(publicRouteRowValidator),
    syncedAt: v.number(),
  },
  returns: syncSummaryValidator,
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncPublicRoutes",
      limit: CONTENT_SYNC_BATCH_LIMITS.generatedPublicRoutes,
      received: args.routes.length,
      unit: "public routes",
    });

    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const route of args.routes) {
      const existing = await ctx.db
        .query("publicRoutes")
        .withIndex("by_locale_and_publicPath", (q) =>
          q.eq("locale", route.locale).eq("publicPath", route.publicPath)
        )
        .unique();
      const next = {
        ...route,
        syncedAt: args.syncedAt,
      };

      if (isSamePublicRoute(existing, next)) {
        unchanged++;
        continue;
      }

      if (existing) {
        await ctx.db.patch("publicRoutes", existing._id, next);
        updated++;
        continue;
      }

      await ctx.db.insert("publicRoutes", next);
      created++;
    }

    return { created, unchanged, updated };
  },
});

export const deleteStaleMaterials = internalMutation({
  args: { limit: v.number(), syncedAt: v.number() },
  returns: deleteResultValidator,
  handler: async (ctx, args) => {
    const staleRows = await ctx.db
      .query("materials")
      .withIndex("by_syncedAt", (q) => q.lt("syncedAt", args.syncedAt))
      .take(args.limit);

    for (const row of staleRows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: staleRows.length };
  },
});

export const deleteStaleMaterialLocales = internalMutation({
  args: {
    limit: v.number(),
    locale: v.optional(localeValidator),
    syncedAt: v.number(),
  },
  returns: deleteResultValidator,
  handler: async (ctx, args) => {
    const locale = args.locale;
    const staleRows =
      locale === undefined
        ? await ctx.db
            .query("materialLocales")
            .withIndex("by_syncedAt", (q) => q.lt("syncedAt", args.syncedAt))
            .take(args.limit)
        : await ctx.db
            .query("materialLocales")
            .withIndex("by_locale_and_syncedAt", (q) =>
              q.eq("locale", locale).lt("syncedAt", args.syncedAt)
            )
            .take(args.limit);

    for (const row of staleRows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: staleRows.length };
  },
});

export const deleteStaleCurricula = internalMutation({
  args: { limit: v.number(), syncedAt: v.number() },
  returns: deleteResultValidator,
  handler: async (ctx, args) => {
    const staleRows = await ctx.db
      .query("curricula")
      .withIndex("by_syncedAt", (q) => q.lt("syncedAt", args.syncedAt))
      .take(args.limit);

    for (const row of staleRows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: staleRows.length };
  },
});

export const deleteStaleCurriculumNodes = internalMutation({
  args: { limit: v.number(), syncedAt: v.number() },
  returns: deleteResultValidator,
  handler: async (ctx, args) => {
    const staleRows = await ctx.db
      .query("curriculumNodes")
      .withIndex("by_syncedAt", (q) => q.lt("syncedAt", args.syncedAt))
      .take(args.limit);

    for (const row of staleRows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: staleRows.length };
  },
});

export const deleteStaleCurriculumMaterials = internalMutation({
  args: { limit: v.number(), syncedAt: v.number() },
  returns: deleteResultValidator,
  handler: async (ctx, args) => {
    const staleRows = await ctx.db
      .query("curriculumMaterials")
      .withIndex("by_syncedAt", (q) => q.lt("syncedAt", args.syncedAt))
      .take(args.limit);

    for (const row of staleRows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: staleRows.length };
  },
});

export const deleteStaleAssessments = internalMutation({
  args: { limit: v.number(), syncedAt: v.number() },
  returns: deleteResultValidator,
  handler: async (ctx, args) => {
    const staleRows = await ctx.db
      .query("assessments")
      .withIndex("by_syncedAt", (q) => q.lt("syncedAt", args.syncedAt))
      .take(args.limit);

    for (const row of staleRows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: staleRows.length };
  },
});

export const deleteStaleAssessmentNodes = internalMutation({
  args: { limit: v.number(), syncedAt: v.number() },
  returns: deleteResultValidator,
  handler: async (ctx, args) => {
    const staleRows = await ctx.db
      .query("assessmentNodes")
      .withIndex("by_syncedAt", (q) => q.lt("syncedAt", args.syncedAt))
      .take(args.limit);

    for (const row of staleRows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: staleRows.length };
  },
});

export const deleteStalePublicRoutes = internalMutation({
  args: { limit: v.number(), syncedAt: v.number() },
  returns: deleteResultValidator,
  handler: async (ctx, args) => {
    const staleRows = await ctx.db
      .query("publicRoutes")
      .withIndex("by_syncedAt", (q) => q.lt("syncedAt", args.syncedAt))
      .take(args.limit);

    for (const row of staleRows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: staleRows.length };
  },
});

/**
 * Checks whether one stored route already matches the next projection row.
 *
 * Public route sync is idempotent and route rows are stable, so this keeps
 * repeated syncs from touching unchanged documents and causing extra OCC churn.
 */
function isSamePublicRoute(
  existing: SyncedPublicRouteRow | null,
  next: SyncedPublicRouteRow
) {
  if (!existing) {
    return false;
  }

  return (
    existing.canonicalPath === next.canonicalPath &&
    existing.description === next.description &&
    existing.kind === next.kind &&
    existing.locale === next.locale &&
    existing.materialDomain === next.materialDomain &&
    existing.materialKey === next.materialKey &&
    existing.nodeKey === next.nodeKey &&
    existing.parentPath === next.parentPath &&
    existing.programKey === next.programKey &&
    existing.publicPath === next.publicPath &&
    existing.sectionKey === next.sectionKey &&
    existing.sitemap === next.sitemap &&
    existing.sourcePath === next.sourcePath &&
    existing.title === next.title
  );
}
