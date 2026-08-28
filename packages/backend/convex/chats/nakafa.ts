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
} from "@repo/backend/convex/contents/helpers/search/schema";
import {
  localeValidator,
  nakafaSectionValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { v } from "convex/values";

export const nakafaReadInputValidator = v.object({
  content_ref: v.string(),
});

export const nakafaQuranInputValidator = v.object({
  from_verse: v.number(),
  include_tafsir: v.boolean(),
  locale: localeValidator,
  surah: v.number(),
  to_verse: v.optional(v.number()),
});

export const nakafaTaxonomyInputValidator = v.object({
  locale: localeValidator,
});

export const nakafaContentPreviewValidator = v.object({
  ...contentSearchRefValidator.fields,
  description: v.optional(v.string()),
  title: v.string(),
});

const nakafaQuranPreviewFields = {
  ...contentSearchRefValidator.fields,
  from_verse: v.number(),
  name: v.string(),
  revelation: v.string(),
  to_verse: v.number(),
  verse_count: v.number(),
};

const nakafaQuranTranslationPreviewValidator = v.object({
  ...nakafaQuranPreviewFields,
  translation: v.string(),
});

/** Builds one canonical Quran preview correlated to its request locale. */
function makeNakafaQuranDoneValidator<const Locale extends AppLocaleCode>(
  locale: Locale
) {
  return v.object({
    kind: v.literal("quran"),
    status: v.literal("done"),
    input: v.object({
      ...nakafaQuranInputValidator.fields,
      locale: v.literal(locale),
    }),
    result: v.object({
      ...nakafaQuranPreviewFields,
      locale: v.literal(locale),
      meaning: v.object({
        locale: v.union(v.literal(locale), v.literal(ENGLISH_APP_LOCALE_CODE)),
        text: v.string(),
      }),
    }),
  });
}

const nakafaQuranDoneValidators = [
  makeNakafaQuranDoneValidator(ENGLISH_APP_LOCALE_CODE),
  makeNakafaQuranDoneValidator(INDONESIAN_APP_LOCALE_CODE),
  makeNakafaQuranDoneValidator(GERMAN_APP_LOCALE_CODE),
] as const;

export const nakafaTaxonomyPreviewValidator = v.object({
  content_counts: v.array(
    v.object({
      count: v.number(),
      locale: localeValidator,
    })
  ),
  locale: localeValidator,
  sections: v.array(nakafaSectionValidator),
  tools: v.array(v.string()),
});

export const nakafaDataValidator = v.union(
  v.object({
    kind: v.literal("search"),
    status: v.literal("loading"),
    input: contentSearchInputValidator,
  }),
  v.object({
    kind: v.literal("search"),
    status: v.literal("done"),
    input: contentSearchInputValidator,
    result: contentSearchResultValidator,
  }),
  v.object({
    kind: v.literal("search"),
    status: v.literal("error"),
    input: contentSearchInputValidator,
    error: v.string(),
  }),
  v.object({
    kind: v.literal("content"),
    status: v.literal("loading"),
    input: nakafaReadInputValidator,
  }),
  v.object({
    kind: v.literal("content"),
    status: v.literal("done"),
    input: nakafaReadInputValidator,
    result: nakafaContentPreviewValidator,
  }),
  v.object({
    kind: v.literal("content"),
    status: v.literal("error"),
    input: nakafaReadInputValidator,
    error: v.string(),
  }),
  v.object({
    kind: v.literal("quran"),
    status: v.literal("loading"),
    input: nakafaQuranInputValidator,
  }),
  ...nakafaQuranDoneValidators,
  v.object({
    kind: v.literal("quran"),
    status: v.literal("done"),
    input: nakafaQuranInputValidator,
    result: nakafaQuranTranslationPreviewValidator,
  }),
  v.object({
    kind: v.literal("quran"),
    status: v.literal("error"),
    input: nakafaQuranInputValidator,
    error: v.string(),
  }),
  v.object({
    kind: v.literal("taxonomy"),
    status: v.literal("loading"),
    input: nakafaTaxonomyInputValidator,
  }),
  v.object({
    kind: v.literal("taxonomy"),
    status: v.literal("done"),
    input: nakafaTaxonomyInputValidator,
    result: nakafaTaxonomyPreviewValidator,
  }),
  v.object({
    kind: v.literal("taxonomy"),
    status: v.literal("error"),
    input: nakafaTaxonomyInputValidator,
    error: v.string(),
  })
);
