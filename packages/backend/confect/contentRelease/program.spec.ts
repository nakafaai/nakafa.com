import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import {
  appLocaleValidator,
  releasePageArgs,
  releasePageValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export const programPageValidator = Schema.Struct({
  ...releasePageValidator(Schema.String).fields,
  snapshotId: Schema.Union([Schema.String, Schema.Null]),
});
export const programCatalogValidator = Schema.Struct({
  activeManifestHash: Schema.Union([Schema.String, Schema.Null]),
  activeReleaseId: Schema.Union([Schema.String, Schema.Null]),
  managed: Schema.Boolean,
  programJson: Schema.mutable(Schema.Array(Schema.String)),
  routeJson: Schema.mutable(Schema.Array(Schema.String)),
  snapshotId: Schema.Union([Schema.String, Schema.Null]),
  sourceRevision: Schema.Union([Schema.String, Schema.Null]),
});
export const programRouteValidator = Schema.Struct({
  activeManifestHash: Schema.Union([Schema.String, Schema.Null]),
  activeReleaseId: Schema.Union([Schema.String, Schema.Null]),
  alternateJson: Schema.mutable(Schema.Array(Schema.String)),
  ancestorJson: Schema.mutable(Schema.Array(Schema.String)),
  childJson: Schema.mutable(Schema.Array(Schema.String)),
  contextJson: Schema.mutable(Schema.Array(Schema.String)),
  groupJson: Schema.mutable(Schema.Array(Schema.String)),
  managed: Schema.Boolean,
  materialJson: Schema.mutable(Schema.Array(Schema.String)),
  programJson: Schema.Union([Schema.String, Schema.Null]),
  routeJson: Schema.Union([Schema.String, Schema.Null]),
  snapshotId: Schema.Union([Schema.String, Schema.Null]),
  sourceRevision: Schema.Union([Schema.String, Schema.Null]),
});
export const programContextValidator = Schema.Struct({
  groupJson: Schema.Union([Schema.String, Schema.Null]),
  managed: Schema.Boolean,
  mappingJson: Schema.Union([Schema.String, Schema.Null]),
  parentJson: Schema.Union([Schema.String, Schema.Null]),
  resolvedCanonicalPath: Schema.Union([Schema.String, Schema.Null]),
});
export const programPathValidator = Schema.Struct({
  managed: Schema.Boolean,
  routeJson: Schema.Union([Schema.String, Schema.Null]),
});
export const programBucketsValidator = Schema.Struct({
  buckets: Schema.mutable(Schema.Array(Schema.String)),
  managed: Schema.Boolean,
  routeCount: Schema.Finite,
});
export const programSitemapValidator = Schema.Union([
  Schema.Null,
  Schema.Struct({
    routes: Schema.mutable(
      Schema.Array(
        Schema.Struct({
          publicPath: Schema.String,
        })
      )
    ),
  }),
]);

/** Returns the bounded learning-program catalog and localized root routes. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "catalog",
      args: () => ({
        appLocale: appLocaleValidator,
      }),
      returns: () => programCatalogValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "subjects",
      args: () => ({
        appLocale: appLocaleValidator,
      }),
      returns: () =>
        Schema.Struct({
          managed: Schema.Boolean,
          routeJson: Schema.mutable(Schema.Array(Schema.String)),
        }),
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "context",
      args: () => ({
        expectedActiveReleaseId: Schema.optionalKey(
          Schema.Union([Schema.String, Schema.Null])
        ),
        appLocale: appLocaleValidator,
        contentKey: Schema.String,
        materialKey: Schema.String,
        nodeKey: Schema.String,
        parentPath: Schema.String,
        programKey: Schema.String,
        publicPath: Schema.String,
      }),
      returns: () => programContextValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "page",
      args: () => releasePageArgs,
      returns: () => programPageValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "path",
      args: () => ({
        appLocale: appLocaleValidator,
        publicPath: Schema.String,
      }),
      returns: () => programPathValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "route",
      args: () => ({
        appLocale: appLocaleValidator,
        publicPath: Schema.String,
      }),
      returns: () => programRouteValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "sitemapBuckets",
      args: () => ({
        appLocale: appLocaleValidator,
      }),
      returns: () => programBucketsValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "sitemapPage",
      args: () => ({
        appLocale: appLocaleValidator,
        bucket: Schema.String,
      }),
      returns: () => programSitemapValidator,
      error: () => ReleaseError,
    })
  );
