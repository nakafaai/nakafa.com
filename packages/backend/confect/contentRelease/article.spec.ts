import { FunctionSpec, GroupSpec } from "@confect/core";
import { PaginationOptions as PaginationOptionsSchema } from "@confect/core/PaginationOptions";
import { PaginationResult as PaginationResultSchema } from "@confect/core/PaginationResult";
import { ContentAuthorSchema } from "@nakafa/aksara-contracts/content";
import { articleApiPageValidator } from "@repo/backend/confect/contentRelease/article/spec";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import {
  appLocaleValidator,
  artifactLocaleValidator,
  rendererDomainValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export const projectionValidator = Schema.Struct({
  appLocale: appLocaleValidator,
  artifactLocale: artifactLocaleValidator,
  contentKey: Schema.String,
  family: Schema.Literal("article"),
  projectionHash: Schema.String,
  projectionJson: Schema.String,
  publicPath: Schema.String,
  releaseId: Schema.String,
  rendererDomain: rendererDomainValidator,
  sequence: Schema.Finite,
  sourcePath: Schema.String,
});
export const categoryValidator = Schema.Struct({
  category: Schema.String,
  rendererDomain: rendererDomainValidator,
  route: Schema.String,
  title: Schema.String,
});
export const articleSummaryValidator = Schema.Struct({
  articleSlug: Schema.String,
  authors: Schema.mutable(Schema.Array(ContentAuthorSchema)),
  category: Schema.String,
  categoryTitle: Schema.String,
  // Aksara's date fields add calendar checks, which a return must not add.
  dateModified: Schema.optionalKey(Schema.String),
  datePublished: Schema.String,
  // Aksara's description also accepts undefined; the return keeps exact absence.
  description: Schema.optionalKey(Schema.String),
  official: Schema.Boolean,
  publicPath: Schema.String,
  route: Schema.Struct({
    category: Schema.String,
    slug: Schema.String,
  }),
  title: Schema.String,
});
export const articlePageValidator = Schema.Struct({
  activeManifestHash: Schema.Union([Schema.String, Schema.Null]),
  activeReleaseId: Schema.Union([Schema.String, Schema.Null]),
  managed: Schema.Boolean,
  result: PaginationResultSchema(projectionValidator),
  sourceRevision: Schema.Union([Schema.String, Schema.Null]),
  stale: Schema.Boolean,
});
export const categoryPageValidator = Schema.Struct({
  activeManifestHash: Schema.Union([Schema.String, Schema.Null]),
  activeReleaseId: Schema.Union([Schema.String, Schema.Null]),
  managed: Schema.Boolean,
  result: PaginationResultSchema(categoryValidator),
  sourceRevision: Schema.Union([Schema.String, Schema.Null]),
  stale: Schema.Boolean,
});
export const sitemapBucketsValidator = Schema.Struct({
  activeReleaseId: Schema.Union([Schema.String, Schema.Null]),
  articleCount: Schema.Finite,
  buckets: Schema.mutable(Schema.Array(Schema.String)),
  managed: Schema.Boolean,
});
export const articleDiscoveryValidator = Schema.Struct({
  activeReleaseId: Schema.Union([Schema.String, Schema.Null]),
  articles: Schema.mutable(Schema.Array(articleSummaryValidator)),
  managed: Schema.Boolean,
});
export const articleBucketValidator = Schema.Struct({
  activeReleaseId: Schema.Union([Schema.String, Schema.Null]),
  articles: Schema.Union([
    Schema.mutable(Schema.Array(articleSummaryValidator)),
    Schema.Null,
  ]),
  managed: Schema.Boolean,
});
export const sitemapPageValidator = Schema.Union([
  Schema.Struct({
    routes: Schema.mutable(
      Schema.Array(
        Schema.Struct({
          lastModified: Schema.optionalKey(Schema.String),
          publicPath: Schema.String,
        })
      )
    ),
  }),
  Schema.Null,
]);
export const articleModelValidator = Schema.Struct({
  activeAppLocales: Schema.mutable(Schema.Array(appLocaleValidator)),
  activeReleaseId: Schema.String,
  alternateJson: Schema.mutable(Schema.Array(Schema.String)),
  projectionJson: Schema.Union([Schema.String, Schema.Null]),
});

/** Delivers one generation-consistent public article shell and signed body. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "delivery",
      args: () => ({
        appLocale: appLocaleValidator,
        publicPath: Schema.String,
      }),
      returns: () =>
        Schema.Struct({
          model: articleModelValidator,
          runtimeJson: Schema.Union([Schema.String, Schema.Null]),
        }),
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "apiPage",
      args: () => ({
        cursor: Schema.Union([Schema.String, Schema.Null]),
        limit: Schema.Finite,
        appLocale: appLocaleValidator,
        prefix: Schema.String,
      }),
      returns: () => articleApiPageValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "route",
      args: () => ({
        appLocale: appLocaleValidator,
        expectedActiveReleaseId: Schema.optionalKey(
          Schema.Union([Schema.String, Schema.Null])
        ),
        publicPath: Schema.String,
      }),
      returns: () => articleModelValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "publications",
      args: () => ({
        category: Schema.String,
        expectedManifestHash: Schema.Union([Schema.String, Schema.Null]),
        expectedReleaseId: Schema.Union([Schema.String, Schema.Null]),
        appLocale: appLocaleValidator,
        paginationOpts: PaginationOptionsSchema,
      }),
      returns: () => articlePageValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "categories",
      args: () => ({
        expectedManifestHash: Schema.Union([Schema.String, Schema.Null]),
        expectedReleaseId: Schema.Union([Schema.String, Schema.Null]),
        appLocale: appLocaleValidator,
        paginationOpts: PaginationOptionsSchema,
      }),
      returns: () => categoryPageValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "bucket",
      args: () => ({
        bucket: Schema.String,
        appLocale: appLocaleValidator,
      }),
      returns: () => articleBucketValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "latest",
      args: () => ({
        limit: Schema.Finite,
        appLocale: appLocaleValidator,
      }),
      returns: () => articleDiscoveryValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "listing",
      args: () => ({
        category: Schema.String,
        limit: Schema.Finite,
        appLocale: appLocaleValidator,
      }),
      returns: () => articleDiscoveryValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "sitemapBuckets",
      args: () => ({
        appLocale: appLocaleValidator,
      }),
      returns: () => sitemapBucketsValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "sitemapPage",
      args: () => ({
        bucket: Schema.String,
        appLocale: appLocaleValidator,
      }),
      returns: () => sitemapPageValidator,
      error: () => ReleaseError,
    })
  );
