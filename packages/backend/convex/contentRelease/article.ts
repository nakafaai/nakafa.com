import { query } from "@repo/backend/convex/_generated/server";
import { readArticleCategory } from "@repo/backend/convex/contentRelease/article/category";
import {
  readArticleBucket,
  readCategoryArticles,
  readLatestArticles,
} from "@repo/backend/convex/contentRelease/article/discovery";
import {
  readArticlePage,
  readCategoryPage,
} from "@repo/backend/convex/contentRelease/article/read";
import {
  readArticleBuckets,
  readArticleSitemap,
} from "@repo/backend/convex/contentRelease/article/sitemap";
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

const projectionValidator = v.object({
  contentKey: v.string(),
  family: v.literal("article"),
  locale: localeValidator,
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
  title: v.string(),
});

const articleSummaryValidator = v.object({
  articleSlug: v.string(),
  authors: v.array(v.object({ name: v.string() })),
  category: v.string(),
  categoryTitle: v.string(),
  date: v.string(),
  description: v.optional(v.string()),
  official: v.boolean(),
  publicPath: v.string(),
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
  articleCount: v.number(),
  buckets: v.array(v.string()),
  managed: v.boolean(),
});

const articleDiscoveryValidator = v.object({
  articles: v.array(articleSummaryValidator),
  managed: v.boolean(),
});

const articleBucketValidator = v.object({
  articles: v.union(v.array(articleSummaryValidator), v.null()),
  managed: v.boolean(),
});

const sitemapPageValidator = v.union(
  v.object({
    routes: v.array(
      v.object({
        date: v.union(v.string(), v.null()),
        publicPath: v.string(),
      })
    ),
  }),
  v.null()
);

/** Returns one release-bound newest-first article page. */
export const page = query({
  args: {
    category: v.string(),
    expectedManifestHash: v.union(v.string(), v.null()),
    expectedReleaseId: v.union(v.string(), v.null()),
    locale: localeValidator,
    paginationOpts: paginationOptsValidator,
  },
  returns: articlePageValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      readArticlePage(
        ctx,
        args.category,
        args.locale,
        args.expectedManifestHash,
        args.expectedReleaseId,
        args.paginationOpts
      )
    ),
});

/** Returns one release-bound localized article-category page. */
export const categories = query({
  args: {
    expectedManifestHash: v.union(v.string(), v.null()),
    expectedReleaseId: v.union(v.string(), v.null()),
    locale: localeValidator,
    paginationOpts: paginationOptsValidator,
  },
  returns: categoryPageValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      readCategoryPage(
        ctx,
        args.locale,
        args.expectedManifestHash,
        args.expectedReleaseId,
        args.paginationOpts
      )
    ),
});

/** Resolves one exact category without scanning its article rows. */
export const category = query({
  args: {
    category: v.string(),
    locale: localeValidator,
  },
  returns: categoryLookupValidator,
  handler: (ctx, args) =>
    runConvexProgram(readArticleCategory(ctx, args.locale, args.category)),
});

/** Returns one managed hash partition for agent-facing article indexes. */
export const bucket = query({
  args: {
    bucket: v.string(),
    locale: localeValidator,
  },
  returns: articleBucketValidator,
  handler: (ctx, args) =>
    runConvexProgram(readArticleBucket(ctx, args.locale, args.bucket)),
});

/** Returns a bounded newest-first article set for discovery surfaces. */
export const latest = query({
  args: {
    limit: v.number(),
    locale: localeValidator,
  },
  returns: articleDiscoveryValidator,
  handler: (ctx, args) =>
    runConvexProgram(readLatestArticles(ctx, args.locale, args.limit)),
});

/** Returns a bounded newest-first article set for one exact category. */
export const listing = query({
  args: {
    category: v.string(),
    limit: v.number(),
    locale: localeValidator,
  },
  returns: articleDiscoveryValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      readCategoryArticles(ctx, args.locale, args.category, args.limit)
    ),
});

/** Returns non-empty deterministic sitemap partitions for one locale. */
export const sitemapBuckets = query({
  args: { locale: localeValidator },
  returns: sitemapBucketsValidator,
  handler: (ctx, { locale }) =>
    runConvexProgram(readArticleBuckets(ctx, locale)),
});

/** Returns one verified article sitemap partition by its stable bucket. */
export const sitemapPage = query({
  args: {
    bucket: v.string(),
    locale: localeValidator,
  },
  returns: sitemapPageValidator,
  handler: (ctx, { bucket, locale }) =>
    runConvexProgram(readArticleSitemap(ctx, locale, bucket)),
});
