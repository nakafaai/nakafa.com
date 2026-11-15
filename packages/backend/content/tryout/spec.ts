import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";

/**
 * The question the landing demonstrates in one locale, as the JSON text of a question body
 * (`TryoutQuestionBodyText`): its prompt, its one interaction, the key's answer the demonstration
 * reveals, and the reading it was written against. A locale whose catalog serves no set has none.
 */
export const featuredTryoutValidator = Schema.Union([
  Schema.Struct({
    body: Schema.String,
    kind: Schema.Literal("question"),
    versionHash: Sha256HashSchema,
  }),
  Schema.Struct({ kind: Schema.Literal("none") }),
]);
export const tryoutMetadataArgsValidator = {
  appLocale: appLocaleValidator,
  kind: Schema.Literals([
    "country",
    "exam",
    "group",
    "track",
    "set",
    "section",
  ]),
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
