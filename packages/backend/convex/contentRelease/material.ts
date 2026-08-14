import { query } from "@repo/backend/convex/_generated/server";
import {
  readLatestMaterials,
  readMaterialBucket,
} from "@repo/backend/convex/contentRelease/material/discovery";
import { readMaterialIdentity } from "@repo/backend/convex/contentRelease/material/identity";
import { readMaterialModel } from "@repo/backend/convex/contentRelease/material/model";
import { readMaterialPage } from "@repo/backend/convex/contentRelease/material/page";
import {
  readMaterialBuckets,
  readMaterialSitemap,
} from "@repo/backend/convex/contentRelease/material/sitemap";
import { materialApiPageValidator } from "@repo/backend/convex/contentRelease/material/spec";
import { readPartnerApiPage } from "@repo/backend/convex/contentRelease/partner/page";
import {
  appLocaleValidator,
  rendererDomainValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";

const materialModelValidator = v.object({
  activeManifestHash: v.union(v.string(), v.null()),
  activeReleaseId: v.union(v.string(), v.null()),
  alternateJson: v.array(v.string()),
  projectionJson: v.union(v.string(), v.null()),
  rendererDomain: v.union(rendererDomainValidator, v.null()),
  siblingJson: v.array(v.string()),
  sourcePath: v.union(v.string(), v.null()),
  sourceRevision: v.union(v.string(), v.null()),
});

const materialPageValidator = v.object({
  activeManifestHash: v.union(v.string(), v.null()),
  activeReleaseId: v.union(v.string(), v.null()),
  managed: v.boolean(),
  result: paginationResultValidator(v.string()),
  sourceRevision: v.union(v.string(), v.null()),
  stale: v.boolean(),
});

const materialSummaryValidator = v.object({
  authors: v.array(v.object({ name: v.string() })),
  date: v.string(),
  description: v.optional(v.string()),
  publicPath: v.string(),
  sourcePath: v.string(),
  title: v.string(),
});

const materialDiscoveryValidator = v.object({
  activeReleaseId: v.union(v.string(), v.null()),
  managed: v.boolean(),
  materials: v.array(materialSummaryValidator),
});

const materialBucketValidator = v.object({
  activeReleaseId: v.union(v.string(), v.null()),
  managed: v.boolean(),
  materials: v.union(v.array(materialSummaryValidator), v.null()),
});

const materialBucketsValidator = v.object({
  activeReleaseId: v.union(v.string(), v.null()),
  buckets: v.array(v.string()),
  managed: v.boolean(),
  materialCount: v.number(),
});

const materialSitemapValidator = v.union(
  v.null(),
  v.object({
    routes: v.array(
      v.object({
        date: v.string(),
        publicPath: v.string(),
      })
    ),
  })
);

const materialIdentityValidator = v.object({
  activeReleaseId: v.union(v.string(), v.null()),
  managed: v.boolean(),
  publicPath: v.union(v.string(), v.null()),
});

/** Resolves one active material route from its stable signed identity. */
export const identity = query({
  args: {
    appLocale: appLocaleValidator,
    contentKey: v.string(),
    expectedMaterialKey: v.string(),
    expectedSectionKey: v.string(),
  },
  returns: materialIdentityValidator,
  handler: (ctx, args) => runConvexProgram(readMaterialIdentity(ctx, args)),
});

/** Returns one current signed material partner API page. */
export const apiPage = query({
  args: {
    cursor: v.union(v.string(), v.null()),
    limit: v.number(),
    appLocale: appLocaleValidator,
    prefix: v.string(),
  },
  returns: materialApiPageValidator,
  handler: (ctx, args) =>
    runConvexProgram(readPartnerApiPage(ctx, { ...args, family: "material" })),
});

/** Returns one complete managed material discovery partition. */
export const bucket = query({
  args: { appLocale: appLocaleValidator, bucket: v.string() },
  returns: materialBucketValidator,
  handler: (ctx, { appLocale, bucket: bucketId }) =>
    runConvexProgram(readMaterialBucket(ctx, appLocale, bucketId)),
});

/** Returns a bounded newest-first material list for RSS discovery. */
export const latest = query({
  args: { appLocale: appLocaleValidator, limit: v.number() },
  returns: materialDiscoveryValidator,
  handler: (ctx, { appLocale, limit }) =>
    runConvexProgram(readLatestMaterials(ctx, appLocale, limit)),
});

/** Resolves one complete active material shell model by localized path. */
export const route = query({
  args: {
    appLocale: appLocaleValidator,
    expectedActiveReleaseId: v.optional(v.union(v.string(), v.null())),
    publicPath: v.string(),
  },
  returns: materialModelValidator,
  handler: (ctx, { appLocale, expectedActiveReleaseId, publicPath }) =>
    runConvexProgram(
      readMaterialModel(ctx, appLocale, publicPath, expectedActiveReleaseId)
    ),
});

/** Returns non-empty material discovery partitions for one locale. */
export const sitemapBuckets = query({
  args: { appLocale: appLocaleValidator },
  returns: materialBucketsValidator,
  handler: (ctx, { appLocale }) =>
    runConvexProgram(readMaterialBuckets(ctx, appLocale)),
});

/** Returns one verified material sitemap partition. */
export const sitemapPage = query({
  args: { appLocale: appLocaleValidator, bucket: v.string() },
  returns: materialSitemapValidator,
  handler: (ctx, { appLocale, bucket: bucketId }) =>
    runConvexProgram(readMaterialSitemap(ctx, appLocale, bucketId)),
});

/** Returns one release-bound page of active localized material routes. */
export const page = query({
  args: {
    expectedManifestHash: v.union(v.string(), v.null()),
    expectedReleaseId: v.union(v.string(), v.null()),
    appLocale: appLocaleValidator,
    paginationOpts: paginationOptsValidator,
  },
  returns: materialPageValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      readMaterialPage(
        ctx,
        args.appLocale,
        args.expectedManifestHash,
        args.expectedReleaseId,
        args.paginationOpts
      )
    ),
});
