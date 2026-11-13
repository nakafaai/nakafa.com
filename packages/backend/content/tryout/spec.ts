import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";

/**
 * One published question with its key, as a public page shows it (the landing's demonstration, a set page's
 * samples): the JSON text of its question body (`TryoutQuestionBodyText`), with its prompt, its one
 * interaction, the key's answer, the reading it was written against and, on a set page, its explanation;
 * and its item version.
 */
export const keyedQuestionValidator = Schema.Struct({
  body: Schema.String,
  versionHash: Sha256HashSchema,
});

/** A set page's worked samples in question order, or none for a path that names no set. */
export const tryoutSetSamplesValidator = Schema.NullOr(
  Schema.Array(keyedQuestionValidator)
);
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
