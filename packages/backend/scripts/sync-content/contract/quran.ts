import {
  mutableArraySchema,
  SyncSummarySchema,
} from "@repo/backend/scripts/sync-content/contract/schemas";
import { locales } from "@repo/utilities/locales";
import { Schema } from "effect";

const SyncLocaleSchema = Schema.Literal(...locales);

export const QuranSearchSyncResultSchema = SyncSummarySchema;

export const QuranSurahSyncResultSchema = SyncSummarySchema;

export const QuranVerseSyncResultSchema = SyncSummarySchema;

export const QuranStaleDeleteResultSchema = Schema.Struct({
  routesDeleted: Schema.Number,
  searchDeleted: Schema.Number,
  surahsDeleted: Schema.Number,
  versesDeleted: Schema.Number,
});

const QuranLocalizedTextSchema = Schema.mutable(
  Schema.Struct({
    en: Schema.String,
    id: Schema.String,
  })
);

const QuranTextSchema = Schema.mutable(
  Schema.Struct({
    arab: Schema.String,
    transliteration: Schema.mutable(
      Schema.Struct({
        en: Schema.String,
      })
    ),
  })
);

const QuranAudioSchema = Schema.mutable(
  Schema.Struct({
    primary: Schema.String,
    secondary: mutableArraySchema(Schema.String),
  })
);

const QuranPreBismillahSchema = Schema.mutable(
  Schema.Struct({
    audio: QuranAudioSchema,
    text: QuranTextSchema,
    translation: QuranLocalizedTextSchema,
  })
);

const quranSurahMetadataFields = {
  name: Schema.mutable(
    Schema.Struct({
      long: Schema.String,
      short: Schema.String,
      translation: QuranLocalizedTextSchema,
      transliteration: QuranLocalizedTextSchema,
    })
  ),
  number: Schema.Number,
  numberOfVerses: Schema.Number,
  preBismillah: Schema.UndefinedOr(Schema.NullOr(QuranPreBismillahSchema)),
  revelation: Schema.mutable(
    Schema.Struct({
      arab: Schema.String,
      en: Schema.String,
      id: Schema.String,
    })
  ),
  sequence: Schema.Number,
};

export const QuranSurahMetadataSchema = Schema.mutable(
  Schema.Struct(quranSurahMetadataFields)
);

const QuranVerseSchema = Schema.mutable(
  Schema.Struct({
    audio: QuranAudioSchema,
    meta: Schema.mutable(
      Schema.Struct({
        hizbQuarter: Schema.Number,
        juz: Schema.Number,
        manzil: Schema.Number,
        page: Schema.Number,
        ruku: Schema.Number,
        sajda: Schema.mutable(
          Schema.Struct({
            obligatory: Schema.Boolean,
            recommended: Schema.Boolean,
          })
        ),
      })
    ),
    number: Schema.mutable(
      Schema.Struct({
        inQuran: Schema.Number,
        inSurah: Schema.Number,
      })
    ),
    tafsir: Schema.mutable(
      Schema.Struct({
        id: Schema.mutable(
          Schema.Struct({
            long: Schema.String,
            short: Schema.String,
          })
        ),
      })
    ),
    text: QuranTextSchema,
    translation: QuranLocalizedTextSchema,
  })
);

export const QuranSurahPageSchema = Schema.NullOr(
  Schema.mutable(
    Schema.Struct({
      nextSurah: Schema.NullOr(QuranSurahMetadataSchema),
      prevSurah: Schema.NullOr(QuranSurahMetadataSchema),
      surahData: Schema.mutable(
        Schema.Struct({
          ...quranSurahMetadataFields,
          verses: mutableArraySchema(QuranVerseSchema),
        })
      ),
    })
  )
);

export const QuranReferenceSchema = Schema.NullOr(
  Schema.mutable(
    Schema.Struct({
      alignmentId: Schema.String,
      assetId: Schema.String,
      conceptId: Schema.String,
      content_id: Schema.String,
      learningObjectId: Schema.String,
      lensId: Schema.String,
      locale: SyncLocaleSchema,
      markdown_url: Schema.String,
      name: Schema.String,
      revelation: Schema.String,
      route: Schema.String,
      section: Schema.Literal("quran"),
      translation: Schema.String,
      url: Schema.String,
      verses: mutableArraySchema(
        Schema.mutable(
          Schema.Struct({
            arabic: Schema.String,
            number: Schema.Number,
            tafsir: Schema.optional(Schema.String),
            translation: Schema.String,
            transliteration: Schema.String,
          })
        )
      ),
    })
  )
);
