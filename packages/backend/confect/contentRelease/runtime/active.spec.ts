import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import {
  appLocaleValidator,
  contentFamilyValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { activeIdentityValidator } from "@repo/backend/content/publication/spec";
import { Schema } from "effect";

const snapshotDateValidator = Schema.Union([Schema.String, Schema.Null]);
const snapshotDatesValidator = Schema.Struct({
  assessment: snapshotDateValidator,
  program: snapshotDateValidator,
  quran: snapshotDateValidator,
});

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "read",
      args: () => ({}),
      returns: () => activeIdentityValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "frame",
      args: () => ({}),
      returns: () =>
        Schema.NullOr(
          Schema.Struct({
            activeManifestHash: Schema.String,
            activeReleaseId: Schema.String,
            releaseJson: Schema.String,
            rendererJson: Schema.String,
          })
        ),
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "artifact",
      args: () => ({
        appLocale: appLocaleValidator,
        artifactHash: Schema.String,
        family: contentFamilyValidator,
        publicPath: Schema.String,
      }),
      returns: () =>
        Schema.NullOr(Schema.Struct({ artifactJson: Schema.String })),
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "dates",
      args: () => ({}),
      returns: () => snapshotDatesValidator,
      error: () => ReleaseError,
    })
  );
