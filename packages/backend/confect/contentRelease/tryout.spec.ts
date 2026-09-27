import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export const tryoutCatalogValidator = Schema.Struct({
  activeManifestHash: Schema.Union([Schema.String, Schema.Null]),
  activeReleaseId: Schema.Union([Schema.String, Schema.Null]),
  rowJson: Schema.mutable(Schema.Array(Schema.String)),
  snapshotId: Schema.String,
  sourceRevision: Schema.Union([Schema.String, Schema.Null]),
});
export const tryoutSitemapCountValidator = Schema.Struct({
  pageCount: Schema.Finite,
  routeCount: Schema.Finite,
});
export const tryoutSitemapPageValidator = Schema.Union([
  Schema.Struct({
    paths: Schema.mutable(Schema.Array(Schema.String)),
  }),
  Schema.Null,
]);
export const taxonomyOptionValidator = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
});
export const tryoutTaxonomyValidator = Schema.Struct({
  countries: Schema.mutable(Schema.Array(taxonomyOptionValidator)),
  exams: Schema.mutable(Schema.Array(taxonomyOptionValidator)),
  routeCount: Schema.Finite,
});

/** Returns the verified active try-out hierarchy for one locale. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "catalog",
      args: () => ({
        appLocale: appLocaleValidator,
      }),
      returns: () => tryoutCatalogValidator,
      error: () => ReleaseErrorWire,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "sitemapCount",
      args: () => ({
        appLocale: appLocaleValidator,
      }),
      returns: () => tryoutSitemapCountValidator,
      error: () => ReleaseErrorWire,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "sitemapPage",
      args: () => ({
        appLocale: appLocaleValidator,
        page: Schema.Finite,
      }),
      returns: () => tryoutSitemapPageValidator,
      error: () => ReleaseErrorWire,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "taxonomy",
      args: () => ({
        appLocale: appLocaleValidator,
      }),
      returns: () => tryoutTaxonomyValidator,
      error: () => ReleaseErrorWire,
    })
  );
