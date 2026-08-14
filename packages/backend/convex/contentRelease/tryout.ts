import { query } from "@repo/backend/convex/_generated/server";
import { appLocaleValidator } from "@repo/backend/convex/contentRelease/spec";
import { readTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/catalog";
import {
  readTryoutSitemapCount,
  readTryoutSitemapPage,
} from "@repo/backend/convex/contentRelease/tryout/sitemap";
import { readTryoutTaxonomy } from "@repo/backend/convex/contentRelease/tryout/taxonomy";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";

const tryoutCatalogValidator = v.object({
  activeManifestHash: v.union(v.string(), v.null()),
  activeReleaseId: v.union(v.string(), v.null()),
  rowJson: v.array(v.string()),
  snapshotId: v.string(),
  sourceRevision: v.union(v.string(), v.null()),
});

const tryoutSitemapCountValidator = v.object({
  pageCount: v.number(),
  routeCount: v.number(),
});

const tryoutSitemapPageValidator = v.union(
  v.object({ paths: v.array(v.string()) }),
  v.null()
);

const taxonomyOptionValidator = v.object({
  id: v.string(),
  label: v.string(),
});

const tryoutTaxonomyValidator = v.object({
  countries: v.array(taxonomyOptionValidator),
  exams: v.array(taxonomyOptionValidator),
  routeCount: v.number(),
});

/** Returns the verified active try-out hierarchy for one locale. */
export const catalog = query({
  args: { appLocale: appLocaleValidator },
  returns: tryoutCatalogValidator,
  handler: (ctx, { appLocale }) =>
    runConvexProgram(readTryoutCatalog(ctx, appLocale)),
});

/** Returns the bounded sitemap inventory for one active try-out locale. */
export const sitemapCount = query({
  args: { appLocale: appLocaleValidator },
  returns: tryoutSitemapCountValidator,
  handler: (ctx, { appLocale }) =>
    runConvexProgram(readTryoutSitemapCount(ctx, appLocale)),
});

/** Returns one exact verified try-out sitemap page. */
export const sitemapPage = query({
  args: {
    appLocale: appLocaleValidator,
    page: v.number(),
  },
  returns: tryoutSitemapPageValidator,
  handler: (ctx, { appLocale, page }) =>
    runConvexProgram(readTryoutSitemapPage(ctx, appLocale, page)),
});

/** Returns signed localized Tryout options and their public route count. */
export const taxonomy = query({
  args: { appLocale: appLocaleValidator },
  returns: tryoutTaxonomyValidator,
  handler: (ctx, { appLocale }) =>
    runConvexProgram(readTryoutTaxonomy(ctx, appLocale)),
});
