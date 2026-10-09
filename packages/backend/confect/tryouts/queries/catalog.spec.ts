import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import {
  publicTryoutCountryValidator,
  publicTryoutCountryWithExamCountValidator,
  publicTryoutExamValidator,
  publicTryoutSectionValidator,
  publicTryoutSetValidator,
  publicTryoutTrackValidator,
} from "@repo/backend/confect/tryouts/queries/catalogModel";
import {
  featuredTryoutValidator,
  tryoutHubArgsValidator,
  tryoutLocalizedPathArgsValidator,
  tryoutMetadataArgsValidator,
  tryoutMetadataReturnValidator,
  tryoutPageArgsValidator,
} from "@repo/backend/content/tryout/spec";
import { Schema } from "effect";

const sectionPageFields = {
  exam: publicTryoutExamValidator,
  section: publicTryoutSectionValidator,
  set: publicTryoutSetValidator,
  track: publicTryoutTrackValidator,
};
export const sectionPageValidator = Schema.Union([
  Schema.Null,
  Schema.Struct(sectionPageFields),
]);

/** Reads the one signed question demonstrated on the marketing landing page. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getFeaturedQuestion",
      args: () => ({
        appLocale: appLocaleValidator,
      }),
      returns: () => featuredTryoutValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getMetadata",
      args: () => tryoutMetadataArgsValidator,
      returns: () => tryoutMetadataReturnValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getLocalizedPath",
      args: () => tryoutLocalizedPathArgsValidator,
      returns: () => Schema.Union([Schema.String, Schema.Null]),
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getHubPage",
      args: () => tryoutHubArgsValidator.fields,
      returns: () =>
        Schema.Struct({
          countries: Schema.mutable(
            Schema.Array(publicTryoutCountryWithExamCountValidator)
          ),
          sourceRevision: Schema.Union([Schema.String, Schema.Null]),
        }),
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getCountryPage",
      args: () => tryoutPageArgsValidator.fields,
      returns: () =>
        Schema.Union([
          Schema.Null,
          Schema.Struct({
            country: publicTryoutCountryValidator,
            exams: Schema.mutable(Schema.Array(publicTryoutExamValidator)),
            sourceRevision: Schema.Union([Schema.String, Schema.Null]),
          }),
        ]),
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getExamPage",
      args: () => tryoutPageArgsValidator.fields,
      returns: () =>
        Schema.Union([
          Schema.Null,
          Schema.Struct({
            country: publicTryoutCountryValidator,
            exam: publicTryoutExamValidator,
            tracks: Schema.mutable(Schema.Array(publicTryoutTrackValidator)),
          }),
        ]),
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getTrackPage",
      args: () => tryoutPageArgsValidator.fields,
      returns: () =>
        Schema.Union([
          Schema.Null,
          Schema.Struct({
            country: publicTryoutCountryValidator,
            exam: publicTryoutExamValidator,
            track: publicTryoutTrackValidator,
          }),
        ]),
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getSetPage",
      args: () => tryoutPageArgsValidator.fields,
      returns: () =>
        Schema.Union([
          Schema.Null,
          Schema.Struct({
            exam: publicTryoutExamValidator,
            entrySection: Schema.Union([
              publicTryoutSectionValidator,
              Schema.Null,
            ]),
            set: publicTryoutSetValidator,
            sections: Schema.mutable(
              Schema.Array(publicTryoutSectionValidator)
            ),
            track: publicTryoutTrackValidator,
          }),
        ]),
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getSectionPage",
      args: () => tryoutPageArgsValidator.fields,
      returns: () => sectionPageValidator,
      error: () => ReleaseError,
    })
  );
