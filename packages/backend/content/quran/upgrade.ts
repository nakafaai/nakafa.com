import { ENGLISH_APP_LOCALE_CODE } from "@nakafa/aksara-contracts/locale";
import { QuranSurahRowSchema } from "@nakafa/aksara-contracts/quran/spec";
import { QuranSurahRowSchema as LegacyQuranSurahRowSchema } from "@nakafa/aksara-v151/quran/spec";
import { Schema, SchemaTransformation } from "effect";

/** Canonical bidirectional bridge from the signed 0.15.1 surah shape. */
export const LegacyQuranSurahUpgradeSchema = LegacyQuranSurahRowSchema.pipe(
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

export type LegacyQuranSurah = Schema.Codec.Encoded<
  typeof LegacyQuranSurahUpgradeSchema
>;
