import {
  formatQuranMeaning,
  type PublishedQuranSurah,
} from "@repo/backend/content/quran/contract";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { createSEOKeywords } from "@/lib/seo/keywords";
import { fetchSEOTranslationsNamespace } from "@/lib/seo/translations";

/** Generates localized SEO metadata for one Quran surah payload. */
export const generateQuranMetadata = Effect.fn("SEO.generateQuranMetadata")(
  (surah: PublishedQuranSurah, locale: Locale) =>
    Effect.gen(function* () {
      const name = surah.name.arabic;
      const transliteration = surah.name.transliteration;
      const localizedMeaning = formatQuranMeaning(surah.name.meaning, locale);
      const revelation = surah.revelation.place;

      const t = yield* fetchSEOTranslationsNamespace(locale, "SEO");

      return {
        title: t("quran.title", {
          number: surah.number,
          name,
          transliteration,
          translation: localizedMeaning,
        }),
        description: t("quran.description", {
          name,
          transliteration,
          numberOfVerses: surah.numberOfVerses,
        }),
        keywords: createSEOKeywords(
          t("quran.keywords", {
            name,
            transliteration,
            translation: localizedMeaning,
            revelation,
          })
        ),
      };
    })
);
