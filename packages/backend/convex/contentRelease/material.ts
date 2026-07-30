import { query } from "@repo/backend/convex/_generated/server";
import {
  readLatestMaterials,
  readMaterialBucket,
} from "@repo/backend/convex/contentRelease/material/discovery";
import { readMaterialModel } from "@repo/backend/convex/contentRelease/material/model";
import { readMaterialPage } from "@repo/backend/convex/contentRelease/material/page";
import {
  readMaterialBuckets,
  readMaterialSitemap,
} from "@repo/backend/convex/contentRelease/material/sitemap";
import {
  readMaterialClaims,
  readMaterialShell,
} from "@repo/backend/convex/contentRelease/material/source";
import {
  materialSourceCandidateValidator,
  materialSourceClaimValidator,
} from "@repo/backend/convex/contentRelease/material/spec";
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
  familyManaged: v.boolean(),
  managed: v.boolean(),
  projectionJson: v.union(v.string(), v.null()),
  rendererDomain: v.union(rendererDomainValidator, v.null()),
  siblingJson: v.array(v.string()),
  sourceClaims: v.array(materialSourceClaimValidator),
  sourcePath: v.union(v.string(), v.null()),
  sourceProjectionJson: v.array(v.string()),
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
  title: v.string(),
});

const materialDiscoveryValidator = v.object({
  managed: v.boolean(),
  materials: v.array(materialSummaryValidator),
});

const materialBucketValidator = v.object({
  managed: v.boolean(),
  materials: v.union(v.array(materialSummaryValidator), v.null()),
});

const materialBucketsValidator = v.object({
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

const materialClaimsValidator = v.object({
  activeReleaseId: v.union(v.string(), v.null()),
  sourceClaims: v.array(materialSourceClaimValidator),
});

const materialShellValidator = v.object({
  activeReleaseId: v.union(v.string(), v.null()),
  sourceClaims: v.array(materialSourceClaimValidator),
  sourceProjectionJson: v.array(v.string()),
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

/** Resolves exact active claims for one bounded source-owned material set. */
export const claims = query({
  args: {
    expectedActiveReleaseId: v.optional(v.union(v.string(), v.null())),
    sourceCandidates: v.array(materialSourceCandidateValidator),
  },
  returns: materialClaimsValidator,
  handler: (ctx, { expectedActiveReleaseId, sourceCandidates }) =>
    runConvexProgram(
      readMaterialClaims(ctx, sourceCandidates, expectedActiveReleaseId)
    ),
});

/** Resolves one complete active material shell model by localized path. */
export const route = query({
  args: {
    locale: localeValidator,
    publicPath: v.string(),
    sourceCandidates: v.optional(v.array(materialSourceCandidateValidator)),
  },
  returns: materialModelValidator,
  handler: (ctx, { locale, publicPath, sourceCandidates = [] }) =>
    runConvexProgram(
      readMaterialModel(ctx, locale, publicPath, sourceCandidates)
    ),
});

/** Resolves one bounded exact overlay for source-owned material rows. */
export const shell = query({
  args: {
    expectedActiveReleaseId: v.optional(v.union(v.string(), v.null())),
    locale: localeValidator,
    sourceCandidates: v.array(materialSourceCandidateValidator),
  },
  returns: materialShellValidator,
  handler: (ctx, { expectedActiveReleaseId, locale, sourceCandidates }) =>
    runConvexProgram(
      readMaterialShell(ctx, locale, sourceCandidates, expectedActiveReleaseId)
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
