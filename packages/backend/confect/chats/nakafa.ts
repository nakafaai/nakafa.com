import {
  type AppLocaleCode,
  ENGLISH_APP_LOCALE_CODE,
  GERMAN_APP_LOCALE_CODE,
  INDONESIAN_APP_LOCALE_CODE,
} from "@nakafa/aksara-contracts/locale";
import {
  contentSearchInputValidator,
  contentSearchRefValidator,
  contentSearchResultValidator,
} from "@repo/backend/confect/contents/helpers/search/schema";
import {
  localeValidator,
  nakafaSectionValidator,
} from "@repo/backend/confect/lib/validators/contents";
import { Schema } from "effect";
export const nakafaReadInputValidator = Schema.Struct({
  content_ref: Schema.String,
});
export const nakafaQuranInputValidator = Schema.Struct({
  from_verse: Schema.Finite,
  include_tafsir: Schema.Boolean,
  locale: localeValidator,
  surah: Schema.Finite,
  to_verse: Schema.optionalKey(Schema.Finite),
});
export const nakafaTaxonomyInputValidator = Schema.Struct({
  locale: localeValidator,
});
export const nakafaContentPreviewValidator = Schema.Struct({
  ...contentSearchRefValidator.fields,
  description: Schema.optionalKey(Schema.String),
  title: Schema.String,
});
const nakafaQuranPreviewFields = {
  ...contentSearchRefValidator.fields,
  from_verse: Schema.Finite,
  name: Schema.String,
  revelation: Schema.String,
  to_verse: Schema.Finite,
  verse_count: Schema.Finite,
};
const nakafaQuranTranslationPreviewValidator = Schema.Struct({
  ...nakafaQuranPreviewFields,
  translation: Schema.String,
});

/** Builds one canonical Quran preview correlated to its request locale. */
function makeNakafaQuranDoneValidator<const Locale extends AppLocaleCode>(
  locale: Locale
) {
  return Schema.Struct({
    kind: Schema.Literal("quran"),
    status: Schema.Literal("done"),
    input: Schema.Struct({
      ...nakafaQuranInputValidator.fields,
      locale: Schema.Literal(locale),
    }),
    result: Schema.Struct({
      ...nakafaQuranPreviewFields,
      locale: Schema.Literal(locale),
      meaning: Schema.Struct({
        locale: Schema.Union([
          Schema.Literal(locale),
          Schema.Literal(ENGLISH_APP_LOCALE_CODE),
        ]),
        text: Schema.String,
      }),
    }),
  });
}
const nakafaQuranDoneValidators = [
  makeNakafaQuranDoneValidator(ENGLISH_APP_LOCALE_CODE),
  makeNakafaQuranDoneValidator(INDONESIAN_APP_LOCALE_CODE),
  makeNakafaQuranDoneValidator(GERMAN_APP_LOCALE_CODE),
] as const;
export const nakafaTaxonomyPreviewValidator = Schema.Struct({
  content_counts: Schema.mutable(
    Schema.Array(
      Schema.Struct({
        count: Schema.Finite,
        locale: localeValidator,
      })
    )
  ),
  locale: localeValidator,
  sections: Schema.mutable(Schema.Array(nakafaSectionValidator)),
  tools: Schema.mutable(Schema.Array(Schema.String)),
});
export const nakafaDataValidator = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("search"),
    status: Schema.Literal("loading"),
    input: contentSearchInputValidator,
  }),
  Schema.Struct({
    kind: Schema.Literal("search"),
    status: Schema.Literal("done"),
    input: contentSearchInputValidator,
    result: contentSearchResultValidator,
  }),
  Schema.Struct({
    kind: Schema.Literal("search"),
    status: Schema.Literal("error"),
    input: contentSearchInputValidator,
    error: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("content"),
    status: Schema.Literal("loading"),
    input: nakafaReadInputValidator,
  }),
  Schema.Struct({
    kind: Schema.Literal("content"),
    status: Schema.Literal("done"),
    input: nakafaReadInputValidator,
    result: nakafaContentPreviewValidator,
  }),
  Schema.Struct({
    kind: Schema.Literal("content"),
    status: Schema.Literal("error"),
    input: nakafaReadInputValidator,
    error: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("quran"),
    status: Schema.Literal("loading"),
    input: nakafaQuranInputValidator,
  }),
  ...nakafaQuranDoneValidators,
  Schema.Struct({
    kind: Schema.Literal("quran"),
    status: Schema.Literal("done"),
    input: nakafaQuranInputValidator,
    result: nakafaQuranTranslationPreviewValidator,
  }),
  Schema.Struct({
    kind: Schema.Literal("quran"),
    status: Schema.Literal("error"),
    input: nakafaQuranInputValidator,
    error: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("taxonomy"),
    status: Schema.Literal("loading"),
    input: nakafaTaxonomyInputValidator,
  }),
  Schema.Struct({
    kind: Schema.Literal("taxonomy"),
    status: Schema.Literal("done"),
    input: nakafaTaxonomyInputValidator,
    result: nakafaTaxonomyPreviewValidator,
  }),
  Schema.Struct({
    kind: Schema.Literal("taxonomy"),
    status: Schema.Literal("error"),
    input: nakafaTaxonomyInputValidator,
    error: Schema.String,
  }),
]);
