import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/contentRelease/article.spec";
import { readPartnerApiPage } from "@repo/backend/confect/contentRelease/partner/page";
import { articleLayer } from "@repo/backend/content/article/confect";
import {
  readArticleBucket,
  readCategoryArticles,
  readLatestArticles,
} from "@repo/backend/content/article/discovery";
import {
  readArticleDelivery,
  readArticleModel,
} from "@repo/backend/content/article/model";
import {
  readArticlePage,
  readCategoryPage,
} from "@repo/backend/content/article/read";
import {
  readArticleBuckets,
  readArticleSitemap,
} from "@repo/backend/content/article/sitemap";
import { Effect, Layer } from "effect";

const delivery = FunctionImpl.make(
  databaseSchema,
  spec,
  "delivery",
  Effect.fn("contentRelease.article.delivery")(function* ({
    appLocale,
    publicPath,
  }) {
    return yield* readArticleDelivery(appLocale, publicPath).pipe(
      Effect.provide(articleLayer)
    );
  })
);
const apiPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "apiPage",
  Effect.fn("contentRelease.article.apiPage")(function* (args) {
    return yield* readPartnerApiPage({
      ...args,
      family: "article",
    });
  })
);
const route = FunctionImpl.make(
  databaseSchema,
  spec,
  "route",
  Effect.fn("contentRelease.article.route")(function* ({
    appLocale,
    expectedActiveReleaseId,
    publicPath,
  }) {
    return yield* readArticleModel(
      appLocale,
      publicPath,
      expectedActiveReleaseId
    ).pipe(Effect.provide(articleLayer));
  })
);
const publications = FunctionImpl.make(
  databaseSchema,
  spec,
  "publications",
  Effect.fn("contentRelease.article.publications")(function* (args) {
    return yield* readArticlePage(
      args.category,
      args.appLocale,
      args.expectedManifestHash,
      args.expectedReleaseId,
      args.paginationOpts
    ).pipe(Effect.provide(articleLayer));
  })
);
const categories = FunctionImpl.make(
  databaseSchema,
  spec,
  "categories",
  Effect.fn("contentRelease.article.categories")(function* (args) {
    return yield* readCategoryPage(
      args.appLocale,
      args.expectedManifestHash,
      args.expectedReleaseId,
      args.paginationOpts
    ).pipe(Effect.provide(articleLayer));
  })
);
const bucket = FunctionImpl.make(
  databaseSchema,
  spec,
  "bucket",
  Effect.fn("contentRelease.article.bucket")(function* (args) {
    return yield* readArticleBucket(args.appLocale, args.bucket).pipe(
      Effect.provide(articleLayer)
    );
  })
);
const latest = FunctionImpl.make(
  databaseSchema,
  spec,
  "latest",
  Effect.fn("contentRelease.article.latest")(function* (args) {
    return yield* readLatestArticles(args.appLocale, args.limit).pipe(
      Effect.provide(articleLayer)
    );
  })
);
const listing = FunctionImpl.make(
  databaseSchema,
  spec,
  "listing",
  Effect.fn("contentRelease.article.listing")(function* (args) {
    return yield* readCategoryArticles(
      args.appLocale,
      args.category,
      args.limit
    ).pipe(Effect.provide(articleLayer));
  })
);
const sitemapBuckets = FunctionImpl.make(
  databaseSchema,
  spec,
  "sitemapBuckets",
  Effect.fn("contentRelease.article.sitemapBuckets")(function* ({ appLocale }) {
    return yield* readArticleBuckets(appLocale).pipe(
      Effect.provide(articleLayer)
    );
  })
);
const sitemapPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "sitemapPage",
  Effect.fn("contentRelease.article.sitemapPage")(function* ({
    appLocale,
    bucket,
  }) {
    return yield* readArticleSitemap(appLocale, bucket).pipe(
      Effect.provide(articleLayer)
    );
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(delivery),
  Layer.provide(apiPage),
  Layer.provide(route),
  Layer.provide(publications),
  Layer.provide(categories),
  Layer.provide(bucket),
  Layer.provide(latest),
  Layer.provide(listing),
  Layer.provide(sitemapBuckets),
  Layer.provide(sitemapPage),
  GroupImpl.finalize
);
