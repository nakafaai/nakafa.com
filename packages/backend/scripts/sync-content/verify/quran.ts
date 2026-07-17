import { api } from "@repo/backend/convex/_generated/api";
import {
  logError,
  logSuccess,
} from "@repo/backend/scripts/sync-content/cli/logging";
import {
  QuranReferenceSchema,
  QuranSurahPageSchema,
} from "@repo/backend/scripts/sync-content/contract/quran";
import {
  ContentSearchResultSchema,
  RuntimeContentRouteSchema,
} from "@repo/backend/scripts/sync-content/contract/schemas";
import type {
  ConvexConfig,
  SyncOptions,
} from "@repo/backend/scripts/sync-content/contract/types";
import { callConvexQuery } from "@repo/backend/scripts/sync-content/convex/client";
import { readQuranMetadata } from "@repo/contents/_lib/quran";
import { QURAN_TAFSIR_LOCALES } from "@repo/contents/_types/quran";
import { locales } from "@repo/utilities/locales";
import { Effect } from "effect";

/** Verifies representative Quran routes, runtime reads, and search rows. */
export function verifyQuranRuntime(config: ConvexConfig, options: SyncOptions) {
  return Effect.gen(function* () {
    const activeLocales = options.locale ? [options.locale] : locales;

    for (const locale of activeLocales) {
      const route = yield* callConvexQuery(
        config,
        api.contents.queries.runtime.getContentRoute,
        { locale, route: "quran/1" },
        RuntimeContentRouteSchema
      );

      if (!route) {
        logError(`Quran route missing for ${locale}/quran/1`);
        return false;
      }

      logSuccess(`Quran route available for ${locale}/quran/1`);

      const reference = yield* callConvexQuery(
        config,
        api.contents.queries.runtime.getQuranReference,
        {
          fromVerse: 1,
          includeTafsir: true,
          locale,
          surah: 1,
        },
        QuranReferenceSchema
      );

      if (reference?.verses.length !== 1) {
        logError(`Quran reference missing for ${locale} surah 1 verse 1`);
        return false;
      }

      const tafsirEnabled = QURAN_TAFSIR_LOCALES.some(
        (tafsirLocale) => tafsirLocale === locale
      );
      const referenceHasTafsir = reference.verses[0]?.tafsir !== undefined;

      if (referenceHasTafsir !== tafsirEnabled) {
        logError(`Quran reference tafsir locale mismatch for ${locale}`);
        return false;
      }

      logSuccess(`Quran reference available for ${locale} surah 1 verse 1`);

      const search = yield* callConvexQuery(
        config,
        api.contents.queries.search.search,
        {
          limit: 1,
          locale,
          offset: 0,
          queries: [],
          section: "quran",
        },
        ContentSearchResultSchema
      );

      if (search.items.length === 0) {
        logError(`Quran search row missing for ${locale}`);
        return false;
      }

      logSuccess(`Quran search row available for ${locale}`);
    }

    const surahPage = yield* callConvexQuery(
      config,
      api.contents.queries.runtime.getQuranSurahPage,
      { surah: 1 },
      QuranSurahPageSchema
    );

    if (surahPage?.surahData.verses.length !== 7) {
      logError("Quran surah runtime page missing for surah 1");
      return false;
    }

    for (const locale of activeLocales) {
      const { surahData } = surahPage;
      const preBismillahMissing =
        surahData.preBismillah !== null &&
        surahData.preBismillah !== undefined &&
        surahData.preBismillah.translation[locale] === undefined;
      const verseTranslationMissing = surahData.verses.some(
        (verse) => verse.translation[locale] === undefined
      );

      if (
        surahData.name.translation[locale] === undefined ||
        surahData.name.transliteration[locale] === undefined ||
        surahData.revelation[locale] === undefined ||
        preBismillahMissing ||
        verseTranslationMissing
      ) {
        logError(`Quran runtime locale data missing for ${locale}`);
        return false;
      }
    }

    logSuccess("Quran surah runtime page available for surah 1");

    const surahMetadata = yield* readQuranMetadata();

    for (const locale of QURAN_TAFSIR_LOCALES) {
      for (const surah of surahMetadata) {
        const page = yield* callConvexQuery(
          config,
          api.contents.queries.runtime.getQuranSurahPage,
          { surah: surah.number },
          QuranSurahPageSchema
        );

        if (page?.surahData.verses.length !== surah.numberOfVerses) {
          logError(`Quran tafsir corpus missing surah ${surah.number}`);
          return false;
        }

        const tafsirMissing = page.surahData.verses.some((verse) => {
          const tafsir = verse.tafsir[locale];
          return !tafsir?.short.trim();
        });

        if (tafsirMissing) {
          logError(
            `Quran tafsir corpus incomplete for ${locale} surah ${surah.number}`
          );
          return false;
        }
      }

      logSuccess(`Complete ${locale} Quran tafsir corpus available`);
    }

    return true;
  });
}
