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
  localeValidator,
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

const materialIdentityValidator = v.object({
  activeReleaseId: v.union(v.string(), v.null()),
  managed: v.boolean(),
  publicPath: v.union(v.string(), v.null()),
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

/** Returns one current signed material partner API page. */
export const apiPage = query({
  args: {
    cursor: v.union(v.string(), v.null()),
    limit: v.number(),
    locale: localeValidator,
    prefix: v.string(),
  },
  returns: materialApiPageValidator,
  handler: (ctx, args) =>
    runConvexProgram(readPartnerApiPage(ctx, { ...args, family: "material" })),
});

/** Returns one complete managed material discovery partition. */
export const bucket = query({
  args: { bucket: v.string(), locale: localeValidator },
  returns: materialBucketValidator,
  handler: (ctx, { bucket: bucketId, locale }) =>
    runConvexProgram(readMaterialBucket(ctx, locale, bucketId)),
});

/** Returns a bounded newest-first material list for RSS discovery. */
export const latest = query({
  args: { limit: v.number(), locale: localeValidator },
  returns: materialDiscoveryValidator,
  handler: (ctx, { limit, locale }) =>
    runConvexProgram(readLatestMaterials(ctx, locale, limit)),
});

/** Resolves one active signed material by its stable source identity. */
export const identity = query({
  args: {
    contentKey: v.string(),
    expectedMaterialKey: v.string(),
    expectedSectionKey: v.string(),
    locale: localeValidator,
  },
  returns: materialIdentityValidator,
  handler: (ctx, args) => runConvexProgram(readMaterialIdentity(ctx, args)),
});

/** Resolves one complete active material shell model by localized path. */
export const route = query({
  args: {
    expectedActiveReleaseId: v.optional(v.union(v.string(), v.null())),
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: materialModelValidator,
  handler: (ctx, { expectedActiveReleaseId, locale, publicPath }) =>
    runConvexProgram(
      readMaterialModel(ctx, locale, publicPath, expectedActiveReleaseId)
    ),
});

/** Returns non-empty material discovery partitions for one locale. */
export const sitemapBuckets = query({
  args: { locale: localeValidator },
  returns: materialBucketsValidator,
  handler: (ctx, { locale }) =>
    runConvexProgram(readMaterialBuckets(ctx, locale)),
});

/** Returns one verified material sitemap partition. */
export const sitemapPage = query({
  args: { bucket: v.string(), locale: localeValidator },
  returns: materialSitemapValidator,
  handler: (ctx, { bucket: bucketId, locale }) =>
    runConvexProgram(readMaterialSitemap(ctx, locale, bucketId)),
});

/** Returns one release-bound page of active localized material routes. */
export const page = query({
  args: {
    expectedManifestHash: v.union(v.string(), v.null()),
    expectedReleaseId: v.union(v.string(), v.null()),
    locale: localeValidator,
    paginationOpts: paginationOptsValidator,
  },
  returns: materialPageValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      readMaterialPage(
        ctx,
        args.locale,
        args.expectedManifestHash,
        args.expectedReleaseId,
        args.paginationOpts
      )
    ),
});
