import { query } from "@repo/backend/convex/_generated/server";
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
  authors: v.array(v.object({ name: v.string() })),
  category: v.string(),
  categoryTitle: v.string(),
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

/** Returns one release-bound newest-first article page. */
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
        args.paginationOpts
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
