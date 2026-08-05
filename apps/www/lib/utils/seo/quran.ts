import type { QuranSurahRow } from "@nakafa/aksara-contracts/quran/spec";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { createSEOKeywords } from "@/lib/utils/seo/keywords";
import { fetchSEOTranslationsNamespace } from "@/lib/utils/seo/translations";

/** Generates localized SEO metadata for one Quran surah payload. */
export const generateQuranMetadata = Effect.fn("SEO.generateQuranMetadata")(
  (surah: QuranSurahRow, locale: Locale) =>
    Effect.gen(function* () {
      const name = surah.name.arabic;
      const transliteration = surah.name.transliteration;
      const translation = surah.name.translation;
      const revelation = surah.revelation.place;

      const t = yield* fetchSEOTranslationsNamespace(locale, "SEO");

      return {
        title: t("quran.title", {
          number: surah.number,
          name,
          transliteration,
          translation,
        }),
        description: t("quran.description", {
          name,
          transliteration,
          numberOfVerses: surah.numberOfVerses,
        }),
        keywords: createSEOKeywords(
          t("quran.keywords", {
            name,
            translation,
            revelation,
          })
        ),
      };
    })
);
