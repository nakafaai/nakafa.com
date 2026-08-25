import { query } from "@repo/backend/convex/_generated/server";
import { readArticleCategory } from "@repo/backend/convex/contentRelease/article/category";
import {
  readArticleBucket,
  readCategoryArticles,
  readLatestArticles,
} from "@repo/backend/convex/contentRelease/article/discovery";
import { readArticleModel } from "@repo/backend/convex/contentRelease/article/model";
import {
  readArticlePage,
  readCategoryPage,
} from "@repo/backend/convex/contentRelease/article/read";
import {
  readArticleBuckets,
  readArticleSitemap,
} from "@repo/backend/convex/contentRelease/article/sitemap";
import { articleApiPageValidator } from "@repo/backend/convex/contentRelease/article/spec";
import { readPartnerApiPage } from "@repo/backend/convex/contentRelease/partner/page";
import {
  appLocaleValidator,
  artifactLocaleValidator,
  rendererDomainValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";

const projectionValidator = v.object({
  appLocale: appLocaleValidator,
  artifactLocale: artifactLocaleValidator,
  contentKey: v.string(),
  family: v.literal("article"),
  projectionHash: v.string(),
  projectionJson: v.string(),
  publicPath: v.string(),
  releaseId: v.string(),
  rendererDomain: rendererDomainValidator,
  sequence: v.number(),
  sourcePath: v.string(),
});

const categoryValidator = v.object({
  category: v.string(),
  rendererDomain: rendererDomainValidator,
  route: v.string(),
  title: v.string(),
});

const articleSummaryValidator = v.object({
  articleSlug: v.string(),
  authors: v.array(v.object({ name: v.string() })),
  category: v.string(),
  categoryTitle: v.string(),
  date: v.string(),
  dateModified: v.optional(v.string()),
  datePublished: v.string(),
  description: v.optional(v.string()),
  official: v.boolean(),
  publicPath: v.string(),
  route: v.object({
    category: v.string(),
    slug: v.string(),
  }),
  title: v.string(),
});

const articlePageValidator = v.object({
  activeManifestHash: v.union(v.string(), v.null()),
  activeReleaseId: v.union(v.string(), v.null()),
  managed: v.boolean(),
  result: paginationResultValidator(projectionValidator),
  sourceRevision: v.union(v.string(), v.null()),
  stale: v.boolean(),
});

const categoryPageValidator = v.object({
  activeManifestHash: v.union(v.string(), v.null()),
  activeReleaseId: v.union(v.string(), v.null()),
  managed: v.boolean(),
  result: paginationResultValidator(categoryValidator),
  sourceRevision: v.union(v.string(), v.null()),
  stale: v.boolean(),
});

const categoryLookupValidator = v.object({
  exists: v.boolean(),
  managed: v.boolean(),
});

const sitemapBucketsValidator = v.object({
  activeReleaseId: v.union(v.string(), v.null()),
  articleCount: v.number(),
  buckets: v.array(v.string()),
  managed: v.boolean(),
});

const articleDiscoveryValidator = v.object({
  activeReleaseId: v.union(v.string(), v.null()),
  articles: v.array(articleSummaryValidator),
  managed: v.boolean(),
});

const articleBucketValidator = v.object({
  activeReleaseId: v.union(v.string(), v.null()),
  articles: v.union(v.array(articleSummaryValidator), v.null()),
  managed: v.boolean(),
});

const sitemapPageValidator = v.union(
  v.object({
    routes: v.array(
      v.object({
        date: v.union(v.string(), v.null()),
        lastModified: v.union(v.string(), v.null()),
        publicPath: v.string(),
      })
    ),
  }),
  v.null()
);

const articleModelValidator = v.object({
  activeAppLocales: v.array(appLocaleValidator),
  activeReleaseId: v.string(),
  alternateJson: v.array(v.string()),
  projectionJson: v.union(v.string(), v.null()),
});

/** Returns one current signed article partner API page. */
export const apiPage = query({
  args: {
    cursor: v.union(v.string(), v.null()),
    limit: v.number(),
    appLocale: appLocaleValidator,
    prefix: v.string(),
  },
  returns: articleApiPageValidator,
  handler: (ctx, args) =>
    runConvexProgram(readPartnerApiPage(ctx, { ...args, family: "article" })),
});

/** Resolves one complete active article route and its locale counterparts. */
export const route = query({
  args: {
    appLocale: appLocaleValidator,
    expectedActiveReleaseId: v.optional(v.union(v.string(), v.null())),
    publicPath: v.string(),
  },
  returns: articleModelValidator,
  handler: (ctx, { appLocale, expectedActiveReleaseId, publicPath }) =>
    runConvexProgram(
      readArticleModel(ctx, appLocale, publicPath, expectedActiveReleaseId)
    ),
});

/**
 * Retains the predecessor native article cursor during the 0.15.1 bridge.
 *
 * Rollout owner: Nakafa SEO date cutover, PR #342.
 * Removal change: the strict 0.16 Nakafa cutover PR.
 * Remove this query, its predecessor reader, tests, legacy date fields, and
 * legacy indexes only after the protected-main consumer uses `publications`,
 * production execution logs show zero `contentRelease/article:page` calls for
 * 24 consecutive hours after that switch, and EN, ID, and DE production browser
 * acceptance passes. The 24-hour window is Nakafa rollout policy, not a Convex
 * requirement, and does not block the bridge PR itself.
 */
export const page = query({
  args: {
    category: v.string(),
    expectedManifestHash: v.union(v.string(), v.null()),
    expectedReleaseId: v.union(v.string(), v.null()),
    appLocale: appLocaleValidator,
    paginationOpts: paginationOptsValidator,
  },
  returns: articlePageValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      readArticlePage(
        ctx,
        args.category,
        args.appLocale,
        args.expectedManifestHash,
        args.expectedReleaseId,
        args.paginationOpts,
        "predecessor"
      )
    ),
});

/** Returns one release-bound page across both publication-date shapes. */
export const publications = query({
  args: {
    category: v.string(),
    expectedManifestHash: v.union(v.string(), v.null()),
    expectedReleaseId: v.union(v.string(), v.null()),
    appLocale: appLocaleValidator,
    paginationOpts: paginationOptsValidator,
  },
  returns: articlePageValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      readArticlePage(
        ctx,
        args.category,
        args.appLocale,
        args.expectedManifestHash,
        args.expectedReleaseId,
        args.paginationOpts,
        "publication"
      )
    ),
});

/** Returns one release-bound localized article-category page. */
export const categories = query({
  args: {
    expectedManifestHash: v.union(v.string(), v.null()),
    expectedReleaseId: v.union(v.string(), v.null()),
    appLocale: appLocaleValidator,
    paginationOpts: paginationOptsValidator,
  },
  returns: categoryPageValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      readCategoryPage(
        ctx,
        args.appLocale,
        args.expectedManifestHash,
        args.expectedReleaseId,
        args.paginationOpts
      )
    ),
});

/**
 * Retains the predecessor category lookup during the same bounded bridge.
 * The strict cutover removes it only after its production execution logs meet
 * the owner, observation, and browser-acceptance gates documented on `page`.
 */
export const category = query({
  args: {
    category: v.string(),
    appLocale: appLocaleValidator,
  },
  returns: categoryLookupValidator,
  handler: (ctx, args) =>
    runConvexProgram(readArticleCategory(ctx, args.appLocale, args.category)),
});

/** Returns one managed hash partition for agent-facing article indexes. */
export const bucket = query({
  args: {
    bucket: v.string(),
    appLocale: appLocaleValidator,
  },
  returns: articleBucketValidator,
  handler: (ctx, args) =>
    runConvexProgram(readArticleBucket(ctx, args.appLocale, args.bucket)),
});

/** Returns a bounded newest-first article set for discovery surfaces. */
export const latest = query({
  args: {
    limit: v.number(),
    appLocale: appLocaleValidator,
  },
  returns: articleDiscoveryValidator,
  handler: (ctx, args) =>
    runConvexProgram(readLatestArticles(ctx, args.appLocale, args.limit)),
});

/** Returns a bounded newest-first article set for one exact category. */
export const listing = query({
  args: {
    category: v.string(),
    limit: v.number(),
    appLocale: appLocaleValidator,
  },
  returns: articleDiscoveryValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      readCategoryArticles(ctx, args.appLocale, args.category, args.limit)
    ),
});

/** Returns non-empty deterministic sitemap partitions for one locale. */
export const sitemapBuckets = query({
  args: { appLocale: appLocaleValidator },
  returns: sitemapBucketsValidator,
  handler: (ctx, { appLocale }) =>
    runConvexProgram(readArticleBuckets(ctx, appLocale)),
});

/** Returns one verified article sitemap partition by its stable bucket. */
export const sitemapPage = query({
  args: {
    bucket: v.string(),
    appLocale: appLocaleValidator,
  },
  returns: sitemapPageValidator,
  handler: (ctx, { appLocale, bucket }) =>
    runConvexProgram(readArticleSitemap(ctx, appLocale, bucket)),
});
