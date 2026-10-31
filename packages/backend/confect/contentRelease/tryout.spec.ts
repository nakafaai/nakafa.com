import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";

const tryoutSitemapCountValidator = Schema.Struct({
  pageCount: Schema.Finite,
  routeCount: Schema.Finite,
});
const tryoutSitemapPageValidator = Schema.Union([
  Schema.Struct({
    paths: Schema.mutable(Schema.Array(Schema.String)),
  }),
  Schema.Null,
]);
const taxonomyOptionValidator = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
});
const tryoutTaxonomyValidator = Schema.Struct({
  countries: Schema.mutable(Schema.Array(taxonomyOptionValidator)),
  exams: Schema.mutable(Schema.Array(taxonomyOptionValidator)),
  routeCount: Schema.Finite,
});

/** Reads the sitemap and the taxonomy of the active try-out catalog in one locale. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "sitemapCount",
      args: () => ({
        appLocale: appLocaleValidator,
      }),
      returns: () => tryoutSitemapCountValidator,
      error: () => ReleaseError,
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
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "taxonomy",
      args: () => ({
        appLocale: appLocaleValidator,
      }),
      returns: () => tryoutTaxonomyValidator,
      error: () => ReleaseError,
    })
  );
