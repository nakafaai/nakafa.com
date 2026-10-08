import {
  QuranRuntimeVerseSchema,
  QuranSearchRowSchema,
} from "@nakafa/aksara-contracts/quran/snapshot/row";
import {
  quranAppLocaleValidator,
  quranReadingSourcesValidator,
  quranRevelationPlaceValidator,
  quranSourceFields,
  quranSurahMeaningValidator,
  quranTafsirAccessValidator,
  quranTafsirAppLocaleValidator,
  quranTranslationDocumentValidator,
} from "@repo/backend/confect/contentRelease/quran/spec";
import {
  PublishedQuranSurahSchema,
  quranBismillahValidator,
} from "@repo/backend/content/quran/contract";
import { Schema } from "effect";

const quranDocumentSurahValidator = Schema.Struct({
  kind: Schema.Literal("quran-surah"),
  name: Schema.Struct({
    arabic: Schema.String,
    sourceMeaning: quranSurahMeaningValidator,
    transliteration: Schema.String,
  }),
  number: Schema.Finite,
  numberOfVerses: Schema.Finite,
  revelation: Schema.Struct({
    order: Schema.Finite,
    place: quranRevelationPlaceValidator,
  }),
});
const quranDocumentVerseValidator = Schema.Struct({
  arabic: Schema.String,
  number: Schema.Struct({
    inQuran: Schema.Finite,
    inSurah: Schema.Finite,
  }),
  translation: quranTranslationDocumentValidator,
});

/** Exact app-locale Quran document returned to the public content API. */
export const quranDocumentValidator = Schema.Struct({
  ...quranSourceFields,
  appLocale: quranAppLocaleValidator,
  preBismillah: Schema.Union([quranBismillahValidator, Schema.Null]),
  sources: Schema.Union([quranReadingSourcesValidator, Schema.Null]),
  surah: Schema.Union([quranDocumentSurahValidator, Schema.Null]),
  tafsirAccess: Schema.Union([quranTafsirAccessValidator, Schema.Null]),
  verses: Schema.mutable(Schema.Array(quranDocumentVerseValidator)),
});
/** Exact signed tafsir response returned only after one verse is requested. */
export const quranInterpretationValidator = Schema.Struct({
  ...quranSourceFields,
  appLocale: quranTafsirAppLocaleValidator,
  interpretation: Schema.Union([Schema.String, Schema.Null]),
  surahNumber: Schema.Finite,
  tafsirAccess: Schema.Union([quranTafsirAccessValidator, Schema.Null]),
  verseNumber: Schema.Finite,
});
const quranPassageFields = {
  ...quranSourceFields,
  chunkJson: Schema.mutable(Schema.Array(Schema.String)),
  fromVerse: Schema.Finite,
  searchJson: Schema.Union([Schema.String, Schema.Null]),
  sources: Schema.Union([quranReadingSourcesValidator, Schema.Null]),
  surahJson: Schema.Union([Schema.String, Schema.Null]),
  tafsirAccess: Schema.Union([quranTafsirAccessValidator, Schema.Null]),
  toVerse: Schema.Finite,
};

/** Exact bounded Quran passage returned to product and agent readers. */
export const quranPassageValidator = Schema.Struct({
  ...quranPassageFields,
  preBismillah: Schema.Union([quranBismillahValidator, Schema.Null]),
});
/** Decoded fields of one bounded signed Quran passage in its canonical shape. */
export const PublishedQuranReferenceFieldsSchema = Schema.Struct({
  fromVerse: quranPassageValidator.fields.fromVerse,
  preBismillah: quranPassageValidator.fields.preBismillah,
  search: QuranSearchRowSchema,
  sources: quranReadingSourcesValidator,
  surah: PublishedQuranSurahSchema,
  tafsirAccess: quranTafsirAccessValidator,
  toVerse: quranPassageValidator.fields.toVerse,
  verses: Schema.Array(QuranRuntimeVerseSchema),
});
const quranViewNameValidator = Schema.Struct({
  arabic: Schema.String,
  sourceMeaning: quranSurahMeaningValidator,
  transliteration: Schema.String,
});
const quranViewSurahValidator = Schema.Struct({
  name: quranViewNameValidator,
  number: Schema.Finite,
  numberOfVerses: Schema.Finite,
});
const quranViewVerseValidator = Schema.Struct({
  arabic: Schema.String,
  number: Schema.Struct({
    inQuran: Schema.Finite,
    inSurah: Schema.Finite,
  }),
  translation: quranTranslationDocumentValidator,
});

/** Exact app-locale Quran page projection returned to the web app. */
export const quranViewValidator = Schema.Struct({
  ...quranSourceFields,
  appLocale: quranAppLocaleValidator,
  nextSurah: Schema.Union([quranViewSurahValidator, Schema.Null]),
  preBismillah: Schema.Union([quranBismillahValidator, Schema.Null]),
  previousSurah: Schema.Union([quranViewSurahValidator, Schema.Null]),
  sources: Schema.Union([quranReadingSourcesValidator, Schema.Null]),
  surah: Schema.Union([quranViewSurahValidator, Schema.Null]),
  tafsirAccess: Schema.Union([quranTafsirAccessValidator, Schema.Null]),
  verses: Schema.mutable(Schema.Array(quranViewVerseValidator)),
});
export type QuranView = typeof quranViewValidator.Type;
