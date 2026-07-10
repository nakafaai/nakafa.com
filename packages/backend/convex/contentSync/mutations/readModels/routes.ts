import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import {
  publicRouteRowValidator,
  type SyncedPublicRouteRow,
  syncSummaryValidator,
} from "@repo/backend/convex/contentSync/mutations/readModels/schema";
import { internalMutation } from "@repo/backend/convex/functions";
import { v } from "convex/values";

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
        .withIndex("by_locale_and_publicPath", (query) =>
          query.eq("locale", route.locale).eq("publicPath", route.publicPath)
        )
        .unique();
      const next = {
        ...route,
        syncedAt: args.syncedAt,
      };

      if (existing && isSamePublicRoute(existing, next)) {
        await ctx.db.patch("publicRoutes", existing._id, {
          syncedAt: args.syncedAt,
        });
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

/** Checks whether one stored route already matches the next projection row. */
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
    existing.displayGroupIconKey === next.displayGroupIconKey &&
    existing.displayGroupTitle === next.displayGroupTitle &&
    existing.iconKey === next.iconKey &&
    existing.kind === next.kind &&
    existing.level === next.level &&
    existing.locale === next.locale &&
    existing.materialCardDescription === next.materialCardDescription &&
    existing.materialCardTitle === next.materialCardTitle &&
    existing.materialDomain === next.materialDomain &&
    existing.materialKey === next.materialKey &&
    existing.nodeKey === next.nodeKey &&
    existing.order === next.order &&
    existing.parentPath === next.parentPath &&
    existing.programKey === next.programKey &&
    existing.publicPath === next.publicPath &&
    existing.sectionKey === next.sectionKey &&
    existing.sitemap === next.sitemap &&
    existing.sourcePath === next.sourcePath &&
    existing.title === next.title
  );
}
