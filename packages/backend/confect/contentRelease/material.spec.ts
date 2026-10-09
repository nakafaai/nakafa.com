import { FunctionSpec, GroupSpec } from "@confect/core";
import { ContentAuthorSchema } from "@nakafa/aksara-contracts/content";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import {
  materialApiPageValidator,
  materialModelValidator,
  materialNavigationValidator,
} from "@repo/backend/confect/contentRelease/material/spec";
import {
  appLocaleValidator,
  releaseApiPageArgs,
  releasePageArgs,
  releasePageValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { Schema, Struct } from "effect";

const materialPageValidator = releasePageValidator(Schema.String);
const materialSummaryValidator = Schema.Struct({
  authors: Schema.mutable(Schema.Array(ContentAuthorSchema)),
  // Aksara's date fields add calendar checks, which a return must not add.
  dateModified: Schema.optionalKey(Schema.String),
  datePublished: Schema.String,
  description: Schema.optionalKey(Schema.String),
  publicPath: Schema.String,
  sourcePath: Schema.String,
  title: Schema.String,
});
const materialDiscoveryValidator = Schema.Struct({
  activeReleaseId: Schema.Union([Schema.String, Schema.Null]),
  managed: Schema.Boolean,
  materials: Schema.mutable(Schema.Array(materialSummaryValidator)),
});
const materialBucketValidator = Schema.Struct({
  activeReleaseId: Schema.Union([Schema.String, Schema.Null]),
  managed: Schema.Boolean,
  materials: Schema.Union([
    Schema.mutable(Schema.Array(materialSummaryValidator)),
    Schema.Null,
  ]),
});
const materialBucketsValidator = Schema.Struct({
  activeReleaseId: Schema.Union([Schema.String, Schema.Null]),
  buckets: Schema.mutable(Schema.Array(Schema.String)),
  managed: Schema.Boolean,
  materialCount: Schema.Finite,
});
const materialSitemapValidator = Schema.Union([
  Schema.Null,
  Schema.Struct({
    routes: Schema.mutable(
      Schema.Array(
        Schema.Struct({
          lastModified: Schema.String,
          publicPath: Schema.String,
        })
      )
    ),
  }),
]);
const materialIdentityValidator = Schema.Struct({
  activeReleaseId: Schema.Union([Schema.String, Schema.Null]),
  managed: Schema.Boolean,
  publicPath: Schema.Union([Schema.String, Schema.Null]),
});

/** Delivers the signed lesson while navigation uses a reusable group query. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "lesson",
      args: () => ({
        appLocale: appLocaleValidator,
        publicPath: Schema.String,
      }),
      returns: () =>
        Schema.Struct({
          materialKey: Schema.Union([Schema.String, Schema.Null]),
          model: materialModelValidator.mapFields(Struct.omit(["siblingJson"])),
          runtimeJson: Schema.Union([Schema.String, Schema.Null]),
        }),
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "navigation",
      args: () => ({
        appLocale: appLocaleValidator,
        expectedActiveReleaseId: Schema.String,
        materialKey: Schema.String,
      }),
      returns: () => materialNavigationValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "identity",
      args: () => ({
        appLocale: appLocaleValidator,
        contentKey: Schema.String,
        expectedMaterialKey: Schema.String,
        expectedSectionKey: Schema.String,
      }),
      returns: () => materialIdentityValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "apiPage",
      args: () => releaseApiPageArgs,
      returns: () => materialApiPageValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "bucket",
      args: () => ({
        appLocale: appLocaleValidator,
        bucket: Schema.String,
      }),
      returns: () => materialBucketValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "latest",
      args: () => ({
        appLocale: appLocaleValidator,
        limit: Schema.Finite,
      }),
      returns: () => materialDiscoveryValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "publication",
      args: () => ({
        appLocale: appLocaleValidator,
        expectedActiveReleaseId: Schema.optionalKey(
          Schema.Union([Schema.String, Schema.Null])
        ),
        publicPath: Schema.String,
      }),
      returns: () => materialModelValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "sitemapBuckets",
      args: () => ({
        appLocale: appLocaleValidator,
      }),
      returns: () => materialBucketsValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "sitemapPage",
      args: () => ({
        appLocale: appLocaleValidator,
        bucket: Schema.mutable(Schema.Array(Schema.String)),
      }),
      returns: () => materialSitemapValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "publications",
      args: () => releasePageArgs,
      returns: () => materialPageValidator,
      error: () => ReleaseError,
    })
  );
