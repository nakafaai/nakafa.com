import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { computeHash } from "@repo/backend/scripts/lib/mdx-parser/content";
import { callConvex } from "@repo/backend/scripts/sync-content/convex";
import {
  formatDuration,
  log,
  logSuccess,
} from "@repo/backend/scripts/sync-content/logging";
import {
  createBatchProgress,
  formatBatchProgress,
  updateBatchProgress,
} from "@repo/backend/scripts/sync-content/metrics";
import {
  BATCH_SIZES,
  SyncResultSchema,
} from "@repo/backend/scripts/sync-content/schemas";
import type {
  ConvexConfig,
  SyncOptions,
} from "@repo/backend/scripts/sync-content/types";
import { getAllSurah, getSurah, getSurahName } from "@repo/contents/_lib/quran";
import { locales } from "@repo/utilities/locales";
import { Effect, Schema } from "effect";

interface QuranSearchPayload {
  contentHash: string;
  description: string;
  locale: Locale;
  route: string;
  text: string;
  title: string;
}

class QuranSearchSyncError extends Schema.TaggedError<QuranSearchSyncError>()(
  "QuranSearchSyncError",
  {
    message: Schema.String,
  }
) {}

/** Syncs Quran rows into the shared content search read model. */
export const syncQuranSearch = Effect.fn("sync.quranSearch")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
  const startTime = performance.now();

  if (!options.quiet) {
    log("\n--- QURAN SEARCH ---\n");
  }

  const documents = yield* getQuranSearchDocuments(options.locale);
  const totals = { created: 0, updated: 0, unchanged: 0 };
  const totalBatches = Math.ceil(
    documents.length / BATCH_SIZES.quranSearchDocuments
  );
  const progress = createBatchProgress(
    documents.length,
    BATCH_SIZES.quranSearchDocuments
  );

  for (
    let index = 0;
    index < documents.length;
    index += BATCH_SIZES.quranSearchDocuments
  ) {
    const batch = documents.slice(
      index,
      index + BATCH_SIZES.quranSearchDocuments
    );
    const batchNum = Math.floor(index / BATCH_SIZES.quranSearchDocuments) + 1;

    if (!options.quiet) {
      log(formatBatchProgress(progress, batchNum, totalBatches, batch.length));
    }

    const result = yield* callConvex(
      config,
      "mutation",
      "contents/mutations/search:bulkSyncQuranSearch",
      { documents: batch },
      SyncResultSchema
    ).pipe(
      Effect.mapError(
        (error) => new QuranSearchSyncError({ message: error.message })
      )
    );

    totals.created += result.created;
    totals.updated += result.updated;
    totals.unchanged += result.unchanged;
    updateBatchProgress(progress, batch.length);
  }

  const processed = totals.created + totals.updated + totals.unchanged;
  const durationMs = performance.now() - startTime;
  const itemsPerSecond = durationMs > 0 ? (processed / durationMs) * 1000 : 0;

  if (!options.quiet) {
    log(
      `\nResult: ${totals.created} created, ${totals.updated} updated, ${totals.unchanged} unchanged`
    );
    log(
      `Time: ${formatDuration(durationMs)} (${itemsPerSecond.toFixed(1)} items/sec)`
    );
    logSuccess(`${processed}/${documents.length} Quran search docs synced`);
  }

  return { ...totals, durationMs, itemsPerSecond };
});

/**
 * Builds bounded Quran search payloads for every supported surah and locale.
 *
 * The search read model is not content storage; keeping tafsir in the source
 * reader avoids crossing Convex's 1 MiB document value limit.
 *
 * References:
 * - Convex value size limit:
 *   https://docs.convex.dev/database/types
 * - Convex full-text search:
 *   https://docs.convex.dev/search/text-search
 */
function getQuranSearchDocuments(locale?: Locale) {
  return Effect.gen(function* () {
    const activeLocales = locale ? [locale] : locales;
    const documents: QuranSearchPayload[] = [];

    for (const currentLocale of activeLocales) {
      for (const surahSummary of getAllSurah()) {
        const surah = yield* getSurah(surahSummary.number);
        const title = `${surah.number}. ${getSurahName({
          locale: currentLocale,
          name: surah.name,
        })}`;
        const description = surah.name.translation[currentLocale];
        const verseText = surah.verses
          .map((verse) =>
            [
              verse.number.inSurah.toString(),
              verse.text.arab,
              Object.values(verse.text.transliteration).join(" "),
              verse.translation[currentLocale],
            ].join(" ")
          )
          .join(" ");
        const text = [
          title,
          description,
          surah.revelation[currentLocale],
          verseText,
        ].join(" ");

        documents.push({
          contentHash: computeHash(`${currentLocale}:${surah.number}:${text}`),
          description,
          locale: currentLocale,
          route: `quran/${surah.number}`,
          text,
          title,
        });
      }
    }

    return documents;
  });
}
