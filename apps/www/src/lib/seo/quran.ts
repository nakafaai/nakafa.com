import {
  formatQuranMeaning,
  type PublishedQuranSurah,
} from "@repo/backend/content/quran/contract";
import { Effect } from "effect";
import type { Locale } from "use-intl";
import { createSEOKeywords } from "@/lib/seo/keywords";
import { fetchSEOTranslationsNamespace } from "@/lib/seo/translations";

/** The value a title's message reads as no meaning. */
const EMPTY_MEANING = "__EMPTY__";

/** Generates localized SEO metadata for one Quran surah payload. */
export const generateQuranMetadata = Effect.fn("SEO.generateQuranMetadata")(
  (surah: PublishedQuranSurah, locale: Locale) =>
    Effect.gen(function* () {
      const name = surah.name.arabic;
      const transliteration = surah.name.transliteration;
      const localizedMeaning = formatQuranMeaning(surah.name.meaning, locale);
      const revelation = surah.revelation.place;
      // Hud and Luqman mean themselves, so the title names them once.
      const titleMeaning =
        localizedMeaning === transliteration ? EMPTY_MEANING : localizedMeaning;

      const t = yield* fetchSEOTranslationsNamespace(locale, "SEO");

      return {
        title: t("quran.title", {
          number: surah.number,
          name,
          transliteration,
          translation: titleMeaning,
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
