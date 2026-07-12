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

    logSuccess("Quran surah runtime page available for surah 1");
    return true;
  });
}
