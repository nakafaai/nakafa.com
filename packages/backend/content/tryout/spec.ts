import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { ResponseSpec } from "@repo/backend/confect/response/model";
import { tryoutBodyBatchValidator } from "@repo/backend/confect/tryouts/runtime/body";
import { tryoutQuestionSelectorValidator } from "@repo/backend/confect/tryouts/runtime/spec";
import { Schema } from "effect";

/** Public model for the signed landing demo, including its visible answer feedback. */
export const featuredTryoutValidator = Schema.Struct({
  question: tryoutQuestionSelectorValidator,
  response: ResponseSpec,
});
export const tryoutMetadataArgsValidator = {
  appLocale: appLocaleValidator,
  kind: Schema.Literals(["country", "exam", "track", "set", "section"]),
  publicPath: Schema.String,
};
export const tryoutLocalizedPathArgsValidator = {
  currentAppLocale: appLocaleValidator,
  publicPath: Schema.String,
  targetAppLocale: appLocaleValidator,
};
const tryoutAlternateValidator = Schema.Struct({
  appLocale: appLocaleValidator,
  publicPath: Schema.String,
});
const tryoutSocialImageIdentityValidator = Schema.Struct({
  countryKey: Schema.String,
  examKey: Schema.String,
});
export const tryoutMetadataReturnValidator = Schema.Struct({
  route: Schema.Union([
    Schema.Null,
    Schema.Struct({
      alternates: Schema.mutable(Schema.Array(tryoutAlternateValidator)),
      description: Schema.optionalKey(Schema.String),
      publicPath: Schema.String,
      socialImageIdentity: Schema.Union([
        Schema.Null,
        tryoutSocialImageIdentityValidator,
      ]),
      title: Schema.String,
    }),
  ]),
});
export const tryoutHubArgsValidator = Schema.Struct({
  appLocale: appLocaleValidator,
});
export const tryoutPageArgsValidator = Schema.Struct({
  ...tryoutHubArgsValidator.fields,
  publicPath: Schema.String,
});
const protectedDeliveryValidator = Schema.Union([
  Schema.Literal("authenticated"),
  Schema.Literal("entitled"),
]);
const protectedSelectorValidator = Schema.Struct({
  artifactHash: Schema.String,
  contentKey: Schema.String,
  delivery: protectedDeliveryValidator,
});
export const protectedArgsValidator = {
  bundleHash: Schema.String,
  selectors: Schema.mutable(Schema.Array(protectedSelectorValidator)),
  snapshotId: Schema.String,
};
export const protectedResultValidator = Schema.Union([
  Schema.Null,
  tryoutBodyBatchValidator,
]);

/** Stored protected batch returned only through one internal query. */
export type ProtectedRuntimeBatchRow = typeof protectedResultValidator.Type;
