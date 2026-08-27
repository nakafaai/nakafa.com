import {
  ENGLISH_APP_LOCALE_CODE,
  GERMAN_APP_LOCALE_CODE,
  INDONESIAN_APP_LOCALE_CODE,
} from "@nakafa/aksara-contracts/locale";
import { QuranTranslationDocumentSchema } from "@nakafa/aksara-contracts/quran/notes";
import { QuranSurahRowSchema } from "@nakafa/aksara-contracts/quran/spec";
import {
  NakafaQuranEnglishReadingSourcesSchema,
  NakafaQuranEnglishTafsirAccessSchema,
  NakafaQuranGermanReadingSourcesSchema,
  NakafaQuranGermanTafsirAccessSchema,
  NakafaQuranIndonesianReadingSourcesSchema,
  NakafaQuranIndonesianTafsirAccessSchema,
} from "@repo/contents/_lib/agent/schema/quran/source";
import { NakafaAgentReadableContentRefSchema } from "@repo/contents/_lib/agent/schema/ref";
import { Schema, Struct } from "effect";

/** English-only source-authenticated meaning of a surah name. */
export const NakafaQuranMeaningSchema = Schema.Struct({
  locale: Schema.Literal(ENGLISH_APP_LOCALE_CODE),
  text: QuranSurahRowSchema.fields.name.fields.meaning.fields.text,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));

const NakafaQuranTranslationDocumentSchema =
  QuranTranslationDocumentSchema.mapFields((fields) => ({
    notes: fields.notes.pipe(Schema.mutable),
    segments: fields.segments.pipe(Schema.mutable),
  })).mapFields(Struct.map(Schema.mutableKey));

/** Dedicated signed Bismillah presented before numbered verses. */
export const NakafaQuranBismillahSchema = Schema.Struct({
  arabic: Schema.String.annotate({
    description: "Exact signed Arabic Bismillah text.",
  }),
  translation: NakafaQuranTranslationDocumentSchema.annotate({
    description:
      "Reviewed locale translation of the Bismillah with exact source notes.",
  }),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));

/** One Quran verse with semantic translation-note relationships. */
const NakafaQuranReferenceVerseSchema = Schema.Struct({
  arabic: Schema.String.annotate({
    description: "Arabic Quran verse text.",
  }),
  number: Schema.Finite.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThan(0))
  ).annotate({ description: "Verse number inside the surah." }),
  tafsir: Schema.optional(
    Schema.String.annotate({
      description:
        "Reviewed tafsir text when the locale has an embedded edition and it was requested.",
    })
  ),
  translation: NakafaQuranTranslationDocumentSchema.annotate({
    description:
      "Translation represented as text and note-reference segments plus exact source notes.",
  }),
})
  .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  .annotate({ description: "Nakafa Quran verse reference." });

const NakafaQuranReferenceFields = {
  ...NakafaAgentReadableContentRefSchema.fields,
  meaning: NakafaQuranMeaningSchema,
  name: QuranSurahRowSchema.fields.name.fields.transliteration.annotate({
    description: "Source-authenticated transliterated surah name.",
  }),
  pre_bismillah: Schema.NullOr(NakafaQuranBismillahSchema).annotate({
    description:
      "Dedicated Bismillah before the selected numbered verses when present.",
  }),
  revelation: QuranSurahRowSchema.fields.revelation.fields.place.annotate({
    description: "Source-authenticated revelation place.",
  }),
  verses: Schema.Array(NakafaQuranReferenceVerseSchema)
    .pipe(Schema.mutable, Schema.check(Schema.isMinLength(1)))
    .annotate({ description: "Bounded Quran verses." }),
};

const NakafaQuranEnglishReferenceSchema = Schema.Struct({
  ...NakafaQuranReferenceFields,
  locale: Schema.Literal(ENGLISH_APP_LOCALE_CODE),
  sources: NakafaQuranEnglishReadingSourcesSchema,
  tafsir_access: Schema.NullOr(NakafaQuranEnglishTafsirAccessSchema).annotate({
    description:
      "Signed English Tafsir access, or null for a legacy signed publication without access metadata.",
  }),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));

const NakafaQuranIndonesianReferenceSchema = Schema.Struct({
  ...NakafaQuranReferenceFields,
  locale: Schema.Literal(INDONESIAN_APP_LOCALE_CODE),
  sources: NakafaQuranIndonesianReadingSourcesSchema,
  tafsir_access: NakafaQuranIndonesianTafsirAccessSchema,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));

const NakafaQuranGermanReferenceSchema = Schema.Struct({
  ...NakafaQuranReferenceFields,
  locale: Schema.Literal(GERMAN_APP_LOCALE_CODE),
  sources: NakafaQuranGermanReadingSourcesSchema,
  tafsir_access: Schema.NullOr(NakafaQuranGermanTafsirAccessSchema).annotate({
    description:
      "Signed German Tafsir access, or null for a legacy signed publication without access metadata.",
  }),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));

/** Quran output with source-language meaning and locale-selected reading access. */
export const NakafaAgentQuranReferenceSchema = Schema.Union([
  NakafaQuranEnglishReferenceSchema,
  NakafaQuranIndonesianReferenceSchema,
  NakafaQuranGermanReferenceSchema,
]).annotate({
  description:
    "Nakafa Quran reference with semantic notes and signed source attribution.",
});

export type NakafaAgentQuranReference = Schema.Schema.Type<
  typeof NakafaAgentQuranReferenceSchema
>;
