import { readProgramCatalog } from "@repo/backend/content/program/catalog";
import { readProgramContext } from "@repo/backend/content/program/context";
import { convexProgramLayer } from "@repo/backend/content/program/convex";
import { readProgramPage } from "@repo/backend/content/program/page";
import { readProgramPath } from "@repo/backend/content/program/path";
import { readProgramRoute } from "@repo/backend/content/program/route";
import {
  readProgramBuckets,
  readProgramSitemap,
} from "@repo/backend/content/program/sitemap";
import { query } from "@repo/backend/convex/_generated/server";
import { appLocaleValidator } from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

const programPageValidator = v.object({
  activeManifestHash: v.union(v.string(), v.null()),
  activeReleaseId: v.union(v.string(), v.null()),
  managed: v.boolean(),
  result: paginationResultValidator(v.string()),
  snapshotId: v.union(v.string(), v.null()),
  sourceRevision: v.union(v.string(), v.null()),
  stale: v.boolean(),
});

const programCatalogValidator = v.object({
  activeManifestHash: v.union(v.string(), v.null()),
  activeReleaseId: v.union(v.string(), v.null()),
  managed: v.boolean(),
  programJson: v.array(v.string()),
  routeJson: v.array(v.string()),
  snapshotId: v.union(v.string(), v.null()),
  sourceRevision: v.union(v.string(), v.null()),
});

const programRouteValidator = v.object({
  activeManifestHash: v.union(v.string(), v.null()),
  activeReleaseId: v.union(v.string(), v.null()),
  alternateJson: v.array(v.string()),
  ancestorJson: v.array(v.string()),
  childJson: v.array(v.string()),
  contextJson: v.array(v.string()),
  groupJson: v.array(v.string()),
  managed: v.boolean(),
  materialJson: v.array(v.string()),
  programJson: v.union(v.string(), v.null()),
  routeJson: v.union(v.string(), v.null()),
  snapshotId: v.union(v.string(), v.null()),
  sourceRevision: v.union(v.string(), v.null()),
});

const programContextValidator = v.object({
  groupJson: v.union(v.string(), v.null()),
  managed: v.boolean(),
  mappingJson: v.union(v.string(), v.null()),
  parentJson: v.union(v.string(), v.null()),
  resolvedCanonicalPath: v.union(v.string(), v.null()),
});

const programPathValidator = v.object({
  managed: v.boolean(),
  routeJson: v.union(v.string(), v.null()),
});

const programBucketsValidator = v.object({
  buckets: v.array(v.string()),
  managed: v.boolean(),
  routeCount: v.number(),
});

const programSitemapValidator = v.union(
  v.null(),
  v.object({
    routes: v.array(v.object({ publicPath: v.string() })),
  })
);

/** Returns the bounded learning-program catalog and localized root routes. */
export const catalog = query({
  args: { appLocale: appLocaleValidator },
  returns: programCatalogValidator,
  handler: (ctx, { appLocale }) =>
    runConvexProgram(
      readProgramCatalog(appLocale).pipe(
        Effect.provide(convexProgramLayer(ctx))
      )
    ),
});

/** Resolves a validated curriculum return context for one material route. */
export const context = query({
  args: {
    expectedActiveReleaseId: v.optional(v.union(v.string(), v.null())),
    appLocale: appLocaleValidator,
    contentKey: v.string(),
    materialKey: v.string(),
    nodeKey: v.string(),
    parentPath: v.string(),
    programKey: v.string(),
    publicPath: v.string(),
  },
  returns: programContextValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      readProgramContext(
        args.appLocale,
        {
          contentKey: args.contentKey,
          materialKey: args.materialKey,
          nodeKey: args.nodeKey,
          parentPath: args.parentPath,
          programKey: args.programKey,
          publicPath: args.publicPath,
        },
        args.expectedActiveReleaseId
      ).pipe(
        Effect.provide(convexProgramLayer(ctx)),
        Effect.map(({ context: resolved, managed }) => ({
          groupJson: resolved?.groupJson ?? null,
          managed,
          mappingJson: resolved?.mappingJson ?? null,
          parentJson: resolved?.parentJson ?? null,
          resolvedCanonicalPath: resolved?.resolvedCanonicalPath ?? null,
        }))
      )
    ),
});

/** Returns one release-bound page of localized curriculum routes. */
export const page = query({
  args: {
    expectedManifestHash: v.union(v.string(), v.null()),
    expectedReleaseId: v.union(v.string(), v.null()),
    appLocale: appLocaleValidator,
    paginationOpts: paginationOptsValidator,
  },
  returns: programPageValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      readProgramPage(
        args.appLocale,
        args.expectedManifestHash,
        args.expectedReleaseId,
        args.paginationOpts
      ).pipe(Effect.provide(convexProgramLayer(ctx)))
    ),
});

/** Resolves lightweight curriculum ownership by one exact public path. */
export const path = query({
  args: { appLocale: appLocaleValidator, publicPath: v.string() },
  returns: programPathValidator,
  handler: (ctx, { appLocale, publicPath }) =>
    runConvexProgram(
      readProgramPath(appLocale, publicPath).pipe(
        Effect.provide(convexProgramLayer(ctx))
      )
    ),
});

/** Resolves one complete indexed curriculum page model by public path. */
export const route = query({
  args: { appLocale: appLocaleValidator, publicPath: v.string() },
  returns: programRouteValidator,
  handler: (ctx, { appLocale, publicPath }) =>
    runConvexProgram(
      readProgramRoute(appLocale, publicPath).pipe(
        Effect.provide(convexProgramLayer(ctx))
      )
    ),
});

/** Returns non-empty curriculum sitemap partitions for one locale. */
export const sitemapBuckets = query({
  args: { appLocale: appLocaleValidator },
  returns: programBucketsValidator,
  handler: (ctx, { appLocale }) =>
    runConvexProgram(
      readProgramBuckets(appLocale).pipe(
        Effect.provide(convexProgramLayer(ctx))
      )
    ),
});

/** Returns one verified curriculum sitemap partition. */
export const sitemapPage = query({
  args: { appLocale: appLocaleValidator, bucket: v.string() },
  returns: programSitemapValidator,
  handler: (ctx, { appLocale, bucket }) =>
    runConvexProgram(
      readProgramSitemap(appLocale, bucket).pipe(
        Effect.provide(convexProgramLayer(ctx))
      )
    ),
});
