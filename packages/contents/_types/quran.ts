import { fieldsForEveryLocale, type Locale } from "@repo/utilities/locales";
import { Schema } from "effect";

/** Locales whose Quran tafsir corpus is complete and safe to expose. */
export const QURAN_TAFSIR_LOCALES: readonly Locale[] = ["id"];

const VerseNumberSchema = Schema.Struct({
  inSurah: Schema.Number,
  inQuran: Schema.Number,
}).pipe(Schema.mutable);

const LocalizedTextSchema = Schema.Struct(
  fieldsForEveryLocale(Schema.String)
).pipe(Schema.mutable);

const VerseTextSchema = Schema.Struct({
  arab: Schema.String,
  transliteration: Schema.Struct({
    en: Schema.String,
  }).pipe(Schema.mutable),
}).pipe(Schema.mutable);

const VerseAudioSchema = Schema.Struct({
  primary: Schema.String,
  secondary: Schema.Array(Schema.String).pipe(Schema.mutable),
}).pipe(Schema.mutable);

const VerseTafsirTextSchema = Schema.Struct({
  short: Schema.String,
  long: Schema.String,
}).pipe(Schema.mutable);

const VerseTafsirSchema = Schema.Struct({
  ...fieldsForEveryLocale(Schema.optional(VerseTafsirTextSchema)),
  id: VerseTafsirTextSchema,
}).pipe(Schema.mutable);

const VerseSchema = Schema.Struct({
  number: VerseNumberSchema,
  meta: Schema.Struct({
    juz: Schema.Number,
    page: Schema.Number,
    manzil: Schema.Number,
    ruku: Schema.Number,
    hizbQuarter: Schema.Number,
    sajda: Schema.Struct({
      recommended: Schema.Boolean,
      obligatory: Schema.Boolean,
    }).pipe(Schema.mutable),
  }).pipe(Schema.mutable),
  text: VerseTextSchema,
  translation: LocalizedTextSchema,
  audio: VerseAudioSchema,
  tafsir: VerseTafsirSchema,
}).pipe(Schema.mutable);
export type Verse = Schema.Schema.Type<typeof VerseSchema>;

export const PreBismillahSchema = Schema.Struct({
  text: VerseTextSchema,
  translation: LocalizedTextSchema,
  audio: VerseAudioSchema,
}).pipe(Schema.mutable);

const SurahNameSchema = Schema.Struct({
  short: Schema.String,
  long: Schema.String,
  transliteration: LocalizedTextSchema,
  translation: LocalizedTextSchema,
}).pipe(Schema.mutable);

const RevelationSchema = Schema.Struct({
  arab: Schema.String,
  ...fieldsForEveryLocale(Schema.String),
}).pipe(Schema.mutable);

const surahMetadataFields = {
  number: Schema.Number,
  sequence: Schema.Number,
  numberOfVerses: Schema.Number,
  name: SurahNameSchema,
  revelation: RevelationSchema,
  preBismillah: Schema.optional(Schema.NullOr(PreBismillahSchema)),
};

export const SurahMetadataSchema = Schema.Struct(surahMetadataFields).pipe(
  Schema.mutable
);

export const SurahSchema = Schema.Struct({
  ...surahMetadataFields,
  verses: Schema.Array(VerseSchema).pipe(Schema.mutable),
}).pipe(Schema.mutable);
export type Surah = Schema.Schema.Type<typeof SurahSchema>;
