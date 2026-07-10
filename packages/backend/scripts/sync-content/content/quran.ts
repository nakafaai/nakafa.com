import { internal } from "@repo/backend/convex/_generated/api";
import { computeHash } from "@repo/backend/scripts/lib/mdx-parser/content";
import {
  formatDuration,
  log,
  logSuccess,
} from "@repo/backend/scripts/sync-content/cli/logging";
import {
  QuranSearchSyncResultSchema,
  QuranStaleDeleteResultSchema,
  QuranSurahSyncResultSchema,
  QuranVerseSyncResultSchema,
} from "@repo/backend/scripts/sync-content/contract/quran";
import { BATCH_SIZES } from "@repo/backend/scripts/sync-content/contract/schemas";
import type {
  ConvexConfig,
  SyncOptions,
} from "@repo/backend/scripts/sync-content/contract/types";
import { callConvexMutation } from "@repo/backend/scripts/sync-content/convex/client";
import {
  createBatchProgress,
  formatBatchProgress,
  updateBatchProgress,
} from "@repo/backend/scripts/sync-content/workflow/metrics";
import { getAllSurah, getSurah, getSurahName } from "@repo/contents/_lib/quran";
import type { Surah, Verse } from "@repo/contents/_types/quran";
import { locales } from "@repo/utilities/locales";
import type { FunctionArgs } from "convex/server";
import { Effect, Schema } from "effect";

type QuranSurahPayload = FunctionArgs<
  typeof internal.contentSync.mutations.quran.bulkSyncQuranSurahs
>["surahs"][number];
type QuranVersePayload = FunctionArgs<
  typeof internal.contentSync.mutations.quran.bulkSyncQuranVerses
>["verses"][number];
type QuranSearchPayload = FunctionArgs<
  typeof internal.contents.mutations.search.bulkSyncQuranSearch
>["documents"][number];
type QuranVerseKeyPayload = FunctionArgs<
  typeof internal.contentSync.mutations.quran.deleteStaleQuranRuntime
>["verseKeys"][number];

const QURAN_STALE_CLEANUP_SURAH_BATCH_SIZE = 5;

interface QuranPayloads {
  locales: QuranSearchPayload["locale"][];
  searchDocuments: QuranSearchPayload[];
  surahNumbers: number[];
  surahs: QuranSurahPayload[];
  verseKeys: QuranVerseKeyPayload[];
  verses: QuranVersePayload[];
}

class QuranSyncError extends Schema.TaggedError<QuranSyncError>()(
  "QuranSyncError",
  {
    message: Schema.String,
  }
) {}

/** Syncs Quran metadata, verses, routes, and search rows into Convex. */
export const syncQuran = Effect.fn("sync.quran")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
  const startTime = performance.now();

  if (!options.quiet) {
    log("\n--- QURAN ---\n");
  }

  const payloads = yield* getQuranPayloads(options.locale);
  const totals = { created: 0, updated: 0, unchanged: 0 };

  yield* syncQuranSurahBatches(config, payloads.surahs, options, totals);
  yield* syncQuranVerseBatches(config, payloads.verses, options, totals);
  yield* syncQuranSearchBatches(
    config,
    payloads.searchDocuments,
    options,
    totals
  );
  const staleDelete = yield* deleteStaleQuranRows(config, payloads);

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
    logSuccess(`${processed} Quran runtime/search rows synced`);
    if (
      staleDelete.routesDeleted > 0 ||
      staleDelete.searchDeleted > 0 ||
      staleDelete.surahsDeleted > 0 ||
      staleDelete.versesDeleted > 0
    ) {
      log(
        `Deleted stale Quran rows: ${staleDelete.surahsDeleted} surahs, ${staleDelete.versesDeleted} verses, ${staleDelete.routesDeleted} routes, ${staleDelete.searchDeleted} search rows`
      );
    }
  }

  return { ...totals, durationMs, itemsPerSecond };
});

/** Builds Quran runtime and search payloads from the content authoring source. */
function getQuranPayloads(locale?: QuranSearchPayload["locale"]) {
  return Effect.gen(function* () {
    const activeLocales = locale ? [locale] : [...locales];
    const payloads: QuranPayloads = {
      locales: activeLocales,
      searchDocuments: [],
      surahNumbers: [],
      surahs: [],
      verseKeys: [],
      verses: [],
    };

    for (const surahSummary of getAllSurah()) {
      const surah = yield* getSurah(surahSummary.number);
      payloads.surahNumbers.push(surah.number);
      payloads.surahs.push(buildQuranSurahPayload(surah, activeLocales));
      payloads.searchDocuments.push(
        ...activeLocales.map((currentLocale) =>
          buildQuranSearchPayload(surah, currentLocale)
        )
      );

      for (const verse of surah.verses) {
        payloads.verseKeys.push({
          surahNumber: surah.number,
          verseNumber: verse.number.inSurah,
        });
        payloads.verses.push(buildQuranVersePayload(surah.number, verse));
      }
    }

    return payloads;
  });
}

/** Deletes stale Quran rows after the complete source payload has synced. */
function deleteStaleQuranRows(config: ConvexConfig, payloads: QuranPayloads) {
  return Effect.gen(function* () {
    const total = {
      routesDeleted: 0,
      searchDeleted: 0,
      surahsDeleted: 0,
      versesDeleted: 0,
    };

    for (
      let index = 0;
      index < payloads.surahNumbers.length;
      index += QURAN_STALE_CLEANUP_SURAH_BATCH_SIZE
    ) {
      const cleanupSurahNumbers = payloads.surahNumbers.slice(
        index,
        index + QURAN_STALE_CLEANUP_SURAH_BATCH_SIZE
      );
      const result = yield* callConvexMutation(
        config,
        internal.contentSync.mutations.quran.deleteStaleQuranRuntime,
        {
          cleanupSurahNumbers,
          locales: payloads.locales,
          surahNumbers: payloads.surahNumbers,
          verseKeys: payloads.verseKeys,
        },
        QuranStaleDeleteResultSchema
      ).pipe(
        Effect.mapError(
          (error) => new QuranSyncError({ message: error.message })
        )
      );

      total.routesDeleted += result.routesDeleted;
      total.searchDeleted += result.searchDeleted;
      total.surahsDeleted += result.surahsDeleted;
      total.versesDeleted += result.versesDeleted;
    }

    return total;
  });
}

/** Builds one synced Quran surah payload with locale-specific route metadata. */
function buildQuranSurahPayload(
  surah: Surah,
  activeLocales: QuranSearchPayload["locale"][]
): QuranSurahPayload {
  return {
    contentHash: computeHash(
      JSON.stringify({
        name: surah.name,
        number: surah.number,
        numberOfVerses: surah.numberOfVerses,
        preBismillah: surah.preBismillah,
        revelation: surah.revelation,
        sequence: surah.sequence,
      })
    ),
    name: surah.name,
    number: surah.number,
    numberOfVerses: surah.numberOfVerses,
    preBismillah: surah.preBismillah,
    revelation: surah.revelation,
    routes: activeLocales.map((locale) => {
      const title = `${surah.number}. ${getSurahName({
        locale,
        name: surah.name,
      })}`;
      const description = surah.name.translation[locale];

      return {
        contentHash: computeHash(
          JSON.stringify({
            description,
            locale,
            number: surah.number,
            title,
          })
        ),
        description,
        locale,
        title,
      };
    }),
    sequence: surah.sequence,
  };
}

/** Builds one synced Quran verse payload from the content source verse shape. */
function buildQuranVersePayload(
  surahNumber: number,
  verse: Verse
): QuranVersePayload {
  const tafsir = { id: { short: verse.tafsir.id.short } };

  return {
    audio: verse.audio,
    contentHash: computeHash(
      JSON.stringify({
        audio: verse.audio,
        meta: verse.meta,
        surahNumber,
        tafsir,
        text: verse.text,
        translation: verse.translation,
        verseNumber: verse.number.inSurah,
      })
    ),
    hizbQuarter: verse.meta.hizbQuarter,
    juz: verse.meta.juz,
    manzil: verse.meta.manzil,
    page: verse.meta.page,
    quranNumber: verse.number.inQuran,
    ruku: verse.meta.ruku,
    sajdaObligatory: verse.meta.sajda.obligatory,
    sajdaRecommended: verse.meta.sajda.recommended,
    surahNumber,
    tafsir,
    text: verse.text,
    translation: verse.translation,
    verseNumber: verse.number.inSurah,
  };
}

/** Builds one locale-specific Quran search document from a full surah. */
function buildQuranSearchPayload(
  surah: Surah,
  locale: QuranSearchPayload["locale"]
): QuranSearchPayload {
  const title = `${surah.number}. ${getSurahName({
    locale,
    name: surah.name,
  })}`;
  const description = surah.name.translation[locale];
  const verseText = surah.verses
    .map((verse) =>
      [
        verse.number.inSurah.toString(),
        verse.text.arab,
        Object.values(verse.text.transliteration).join(" "),
        verse.translation[locale],
      ].join(" ")
    )
    .join(" ");
  const text = [title, description, surah.revelation[locale], verseText].join(
    " "
  );

  return {
    contentHash: computeHash(`${locale}:${surah.number}:${text}`),
    description,
    locale,
    route: `quran/${surah.number}`,
    text,
    title,
  };
}

/** Syncs Quran surah payloads in bounded Convex mutation batches. */
function syncQuranSurahBatches(
  config: ConvexConfig,
  surahs: QuranSurahPayload[],
  options: SyncOptions,
  totals: { created: number; unchanged: number; updated: number }
) {
  return Effect.gen(function* () {
    const totalBatches = Math.ceil(surahs.length / BATCH_SIZES.quranSurahs);
    const progress = createBatchProgress(
      surahs.length,
      BATCH_SIZES.quranSurahs
    );

    for (
      let index = 0;
      index < surahs.length;
      index += BATCH_SIZES.quranSurahs
    ) {
      const batch = surahs.slice(index, index + BATCH_SIZES.quranSurahs);
      const batchNum = Math.floor(index / BATCH_SIZES.quranSurahs) + 1;

      if (!options.quiet) {
        log(
          formatBatchProgress(progress, batchNum, totalBatches, batch.length)
        );
      }

      const result = yield* callConvexMutation(
        config,
        internal.contentSync.mutations.quran.bulkSyncQuranSurahs,
        { surahs: batch },
        QuranSurahSyncResultSchema
      ).pipe(
        Effect.mapError(
          (error) => new QuranSyncError({ message: error.message })
        )
      );

      totals.created += result.created;
      totals.updated += result.updated;
      totals.unchanged += result.unchanged;
      updateBatchProgress(progress, batch.length);
    }
  });
}

/** Syncs Quran verse payloads in bounded Convex mutation batches. */
function syncQuranVerseBatches(
  config: ConvexConfig,
  verses: QuranVersePayload[],
  options: SyncOptions,
  totals: { created: number; unchanged: number; updated: number }
) {
  return Effect.gen(function* () {
    const totalBatches = Math.ceil(verses.length / BATCH_SIZES.quranVerses);
    const progress = createBatchProgress(
      verses.length,
      BATCH_SIZES.quranVerses
    );

    for (
      let index = 0;
      index < verses.length;
      index += BATCH_SIZES.quranVerses
    ) {
      const batch = verses.slice(index, index + BATCH_SIZES.quranVerses);
      const batchNum = Math.floor(index / BATCH_SIZES.quranVerses) + 1;

      if (!options.quiet) {
        log(
          formatBatchProgress(progress, batchNum, totalBatches, batch.length)
        );
      }

      const result = yield* callConvexMutation(
        config,
        internal.contentSync.mutations.quran.bulkSyncQuranVerses,
        { verses: batch },
        QuranVerseSyncResultSchema
      ).pipe(
        Effect.mapError(
          (error) => new QuranSyncError({ message: error.message })
        )
      );

      totals.created += result.created;
      totals.updated += result.updated;
      totals.unchanged += result.unchanged;
      updateBatchProgress(progress, batch.length);
    }
  });
}

/** Syncs Quran search payloads in bounded Convex mutation batches. */
function syncQuranSearchBatches(
  config: ConvexConfig,
  documents: QuranSearchPayload[],
  options: SyncOptions,
  totals: { created: number; unchanged: number; updated: number }
) {
  return Effect.gen(function* () {
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
        log(
          formatBatchProgress(progress, batchNum, totalBatches, batch.length)
        );
      }

      const result = yield* callConvexMutation(
        config,
        internal.contents.mutations.search.bulkSyncQuranSearch,
        { documents: batch },
        QuranSearchSyncResultSchema
      ).pipe(
        Effect.mapError(
          (error) => new QuranSyncError({ message: error.message })
        )
      );

      totals.created += result.created;
      totals.updated += result.updated;
      totals.unchanged += result.unchanged;
      updateBatchProgress(progress, batch.length);
    }
  });
}
