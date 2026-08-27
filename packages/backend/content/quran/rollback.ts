import { ENGLISH_APP_LOCALE_CODE } from "@nakafa/aksara-contracts/locale";
import { QuranSurahRowSchema } from "@nakafa/aksara-contracts/quran/spec";
import { QuranSurahRowSchema as RollbackQuranSurahRowSchema } from "@nakafa/aksara-rollback/quran/spec";
import { Schema, SchemaTransformation } from "effect";

/** Canonical bridge from the retained signed rollback surah shape. */
export const RollbackQuranSurahSchema = RollbackQuranSurahRowSchema.pipe(
  Schema.decodeTo(
    QuranSurahRowSchema,
    SchemaTransformation.transform({
      decode: (surah) => ({
        ...surah,
        name: {
          arabic: surah.name.arabic,
          meaning: {
            appLocale: ENGLISH_APP_LOCALE_CODE,
            text: surah.name.translation,
          },
          transliteration: surah.name.transliteration,
        },
      }),
      encode: (surah) => ({
        ...surah,
        name: {
          arabic: surah.name.arabic,
          translation: surah.name.meaning.text,
          transliteration: surah.name.transliteration,
        },
      }),
    })
  )
);
