import { Effect } from "effect";
import type { Locale } from "next-intl";
import type { QuranSurah } from "@/lib/utils/pages/quran";
import { createSEOKeywords } from "@/lib/utils/seo/keywords";
import { fetchSEOTranslationsNamespace } from "@/lib/utils/seo/translations";

/** Generates localized SEO metadata for one Quran surah payload. */
export const generateQuranMetadata = Effect.fn("SEO.generateQuranMetadata")(
  (surah: QuranSurah, locale: Locale) =>
    Effect.gen(function* () {
      const name = surah.name.arabic;
      const transliteration = surah.name.transliteration;
      const localizedMeaning =
        surah.name.meaning.appLocale === locale
          ? surah.name.meaning.text
          : null;
      const translation = localizedMeaning ?? transliteration;
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
            transliteration,
            translation: localizedMeaning ?? "",
            revelation,
          })
        ),
      };
    })
);
