import type { Surah } from "@repo/contents/_types/quran";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { fetchSEOTranslationsNamespace } from "@/lib/utils/seo/translations";

/** Generates localized SEO metadata for one Quran surah payload. */
export const generateQuranMetadata = Effect.fn("SEO.generateQuranMetadata")(
  (surah: Surah, locale: Locale) =>
    Effect.gen(function* () {
      const name = surah.name.short;
      const transliteration =
        surah.name.transliteration[locale] ||
        surah.name.transliteration.en ||
        name;
      const translation =
        surah.name.translation[locale] || surah.name.translation.en || name;
      const revelation = surah.revelation[locale] || surah.revelation.en || "";
      const effectiveTitle = translation || name;

      const t = yield* fetchSEOTranslationsNamespace(locale, "SEO");

      return {
        title: t("quran.title", {
          number: surah.number,
          name,
          transliteration,
          translation: effectiveTitle,
        }),
        description: t("quran.description", {
          name,
          transliteration,
          numberOfVerses: surah.numberOfVerses,
        }),
        keywords: t("quran.keywords", {
          name,
          translation: effectiveTitle,
          revelation,
        })
          .split(", ")
          .map((keyword: string) => keyword.trim()),
      };
    })
);
