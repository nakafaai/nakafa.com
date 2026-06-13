import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import { getContentGraphIdentity } from "@repo/backend/convex/contents/graph";
import {
  deleteContentRoute,
  syncContentRoute,
} from "@repo/backend/convex/contents/helpers/routes/write";
import { buildContentSearchRef } from "@repo/backend/convex/contents/helpers/search/documents";
import { internalMutation } from "@repo/backend/convex/functions";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { ConvexError, v } from "convex/values";

const MAX_QURAN_SURAH_ROWS = 114;
const MAX_QURAN_VERSES_PER_SURAH = 300;
const MAX_QURAN_ROUTE_ROWS = 300;
const MAX_QURAN_SEARCH_ROWS_PER_LOCALE = 200;

const localizedTextValidator = v.object({
  en: v.string(),
  id: v.string(),
});

const quranTextValidator = v.object({
  arab: v.string(),
  transliteration: v.object({
    en: v.string(),
  }),
});

const quranAudioValidator = v.object({
  primary: v.string(),
  secondary: v.array(v.string()),
});

const syncedPreBismillahValidator = v.object({
  audio: quranAudioValidator,
  text: quranTextValidator,
  translation: localizedTextValidator,
});

const syncedQuranNameValidator = v.object({
  long: v.string(),
  short: v.string(),
  transliteration: localizedTextValidator,
  translation: localizedTextValidator,
});

const syncedQuranRevelationValidator = v.object({
  arab: v.string(),
  en: v.string(),
  id: v.string(),
});

const syncedQuranRouteValidator = v.object({
  contentHash: v.string(),
  description: v.string(),
  locale: localeValidator,
  title: v.string(),
});

const syncedQuranSurahValidator = v.object({
  contentHash: v.string(),
  name: syncedQuranNameValidator,
  number: v.number(),
  numberOfVerses: v.number(),
  preBismillah: v.optional(v.union(v.null(), syncedPreBismillahValidator)),
  revelation: syncedQuranRevelationValidator,
  routes: v.array(syncedQuranRouteValidator),
  sequence: v.number(),
});

const syncedQuranVerseValidator = v.object({
  audio: quranAudioValidator,
  contentHash: v.string(),
  hizbQuarter: v.number(),
  juz: v.number(),
  manzil: v.number(),
  page: v.number(),
  quranNumber: v.number(),
  ruku: v.number(),
  sajdaObligatory: v.boolean(),
  sajdaRecommended: v.boolean(),
  surahNumber: v.number(),
  tafsir: v.object({
    id: v.object({
      long: v.string(),
      short: v.string(),
    }),
  }),
  text: quranTextValidator,
  translation: localizedTextValidator,
  verseNumber: v.number(),
});

const syncedQuranVerseKeyValidator = v.object({
  surahNumber: v.number(),
  verseNumber: v.number(),
});

const syncSummaryValidator = v.object({
  created: v.number(),
  unchanged: v.number(),
  updated: v.number(),
});

const staleQuranRuntimeDeleteResultValidator = v.object({
  routesDeleted: v.number(),
  searchDeleted: v.number(),
  surahsDeleted: v.number(),
  versesDeleted: v.number(),
});

/** Upserts Quran surah metadata and locale-specific route catalog rows. */
export const bulkSyncQuranSurahs = internalMutation({
  args: {
    surahs: v.array(syncedQuranSurahValidator),
  },
  returns: syncSummaryValidator,
  /** Applies one bounded Quran surah sync batch. */
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncQuranSurahs",
      limit: CONTENT_SYNC_BATCH_LIMITS.quranSurahs,
      received: args.surahs.length,
      unit: "Quran surahs",
    });

    const now = Date.now();
    let created = 0;
    let unchanged = 0;
    let updated = 0;

    for (const surah of args.surahs) {
      const existingSurah = await ctx.db
        .query("quranSurahs")
        .withIndex("by_number", (q) => q.eq("number", surah.number))
        .unique();

      for (const route of surah.routes) {
        const graph = getContentGraphIdentity({
          kind: "quran-surah",
          locale: route.locale,
          route: `quran/${surah.number}`,
        });

        await syncContentRoute(ctx, {
          ...graph,
          contentHash: route.contentHash,
          description: route.description,
          kind: "quran-surah",
          locale: route.locale,
          markdown: true,
          route: `quran/${surah.number}`,
          section: "quran",
          syncedAt: now,
          title: route.title,
        });
      }

      const nextValues = {
        contentHash: surah.contentHash,
        name: surah.name,
        numberOfVerses: surah.numberOfVerses,
        preBismillah: surah.preBismillah,
        revelation: surah.revelation,
        sequence: surah.sequence,
      };

      if (existingSurah?.contentHash === surah.contentHash) {
        unchanged++;
        continue;
      }

      if (existingSurah) {
        await ctx.db.patch("quranSurahs", existingSurah._id, {
          ...nextValues,
          syncedAt: now,
        });
        updated++;
        continue;
      }

      await ctx.db.insert("quranSurahs", {
        ...nextValues,
        number: surah.number,
        syncedAt: now,
      });
      created++;
    }

    return { created, unchanged, updated };
  },
});

/** Upserts Quran verse rows for bounded surah and verse-range reads. */
export const bulkSyncQuranVerses = internalMutation({
  args: {
    verses: v.array(syncedQuranVerseValidator),
  },
  returns: syncSummaryValidator,
  /** Applies one bounded Quran verse sync batch. */
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncQuranVerses",
      limit: CONTENT_SYNC_BATCH_LIMITS.quranVerses,
      received: args.verses.length,
      unit: "Quran verses",
    });

    const now = Date.now();
    let created = 0;
    let unchanged = 0;
    let updated = 0;

    for (const verse of args.verses) {
      const existingVerse = await ctx.db
        .query("quranVerses")
        .withIndex("by_surahNumber_and_verseNumber", (q) =>
          q
            .eq("surahNumber", verse.surahNumber)
            .eq("verseNumber", verse.verseNumber)
        )
        .unique();

      if (existingVerse?.contentHash === verse.contentHash) {
        unchanged++;
        continue;
      }

      if (existingVerse) {
        await ctx.db.patch("quranVerses", existingVerse._id, {
          ...verse,
          syncedAt: now,
        });
        updated++;
        continue;
      }

      await ctx.db.insert("quranVerses", {
        ...verse,
        syncedAt: now,
      });
      created++;
    }

    return { created, unchanged, updated };
  },
});

/** Deletes Quran runtime rows that no longer exist in the authoring source. */
export const deleteStaleQuranRuntime = internalMutation({
  args: {
    cleanupSurahNumbers: v.optional(v.array(v.number())),
    locales: v.array(localeValidator),
    surahNumbers: v.array(v.number()),
    verseKeys: v.array(syncedQuranVerseKeyValidator),
  },
  returns: staleQuranRuntimeDeleteResultValidator,
  /** Removes bounded stale Quran rows, route rows, and search rows. */
  handler: async (ctx, args) => {
    const expectedSurahNumbers = new Set(args.surahNumbers);
    const expectedVerseKeys = new Set(args.verseKeys.map(getQuranVerseKey));
    const activeLocales = new Set(args.locales);
    const cleanupSurahNumbers = new Set(
      args.cleanupSurahNumbers ?? args.surahNumbers
    );
    const expectedContentIds = new Set(
      args.locales.flatMap((locale) =>
        args.surahNumbers.map(
          (surahNumber) =>
            buildContentSearchRef({
              ...getContentGraphIdentity({
                kind: "quran-surah",
                locale,
                route: `quran/${surahNumber}`,
              }),
              locale,
              route: `quran/${surahNumber}`,
              section: "quran",
            }).content_id
        )
      )
    );

    const surahs = await ctx.db
      .query("quranSurahs")
      .take(MAX_QURAN_SURAH_ROWS + 1);
    assertBoundedRuntimeRows({
      count: surahs.length,
      limit: MAX_QURAN_SURAH_ROWS,
      tableName: "quranSurahs",
    });

    const routes = await ctx.db
      .query("contentRoutes")
      .withIndex("by_kind", (q) => q.eq("kind", "quran-surah"))
      .take(MAX_QURAN_ROUTE_ROWS + 1);
    assertBoundedRuntimeRows({
      count: routes.length,
      limit: MAX_QURAN_ROUTE_ROWS,
      tableName: "contentRoutes",
    });

    let surahsDeleted = 0;
    let versesDeleted = 0;
    let routesDeleted = 0;
    let searchDeleted = 0;

    for (const surah of surahs) {
      if (!expectedSurahNumbers.has(surah.number)) {
        await ctx.db.delete(surah._id);
        cleanupSurahNumbers.add(surah.number);
        surahsDeleted++;
      }
    }

    for (const surahNumber of cleanupSurahNumbers) {
      const verses = await ctx.db
        .query("quranVerses")
        .withIndex("by_surahNumber", (q) => q.eq("surahNumber", surahNumber))
        .take(MAX_QURAN_VERSES_PER_SURAH + 1);
      assertBoundedRuntimeRows({
        count: verses.length,
        limit: MAX_QURAN_VERSES_PER_SURAH,
        tableName: "quranVerses",
      });

      for (const verse of verses) {
        if (!expectedVerseKeys.has(getQuranVerseKey(verse))) {
          await ctx.db.delete(verse._id);
          versesDeleted++;
        }
      }
    }

    for (const route of routes) {
      if (
        activeLocales.has(route.locale) &&
        !expectedContentIds.has(route.content_id)
      ) {
        await deleteContentRoute(ctx, route.content_id);
        routesDeleted++;
      }
    }

    for (const locale of args.locales) {
      const searchRows = await ctx.db
        .query("contentSearch")
        .withIndex("by_locale_and_section_and_title", (q) =>
          q.eq("locale", locale).eq("section", "quran")
        )
        .take(MAX_QURAN_SEARCH_ROWS_PER_LOCALE + 1);
      assertBoundedRuntimeRows({
        count: searchRows.length,
        limit: MAX_QURAN_SEARCH_ROWS_PER_LOCALE,
        tableName: "contentSearch",
      });

      for (const row of searchRows) {
        if (!expectedContentIds.has(row.content_id)) {
          await ctx.db.delete(row._id);
          searchDeleted++;
        }
      }
    }

    return { routesDeleted, searchDeleted, surahsDeleted, versesDeleted };
  },
});

/** Builds the surah-local verse identity used for stale Quran cleanup. */
function getQuranVerseKey(source: {
  surahNumber: number;
  verseNumber: number;
}) {
  return `${source.surahNumber}:${source.verseNumber}`;
}

/** Throws when a supposedly fixed-size Quran runtime table exceeds its bound. */
function assertBoundedRuntimeRows({
  count,
  limit,
  tableName,
}: {
  count: number;
  limit: number;
  tableName: string;
}) {
  if (count <= limit) {
    return;
  }

  throw new ConvexError({
    code: "QURAN_RUNTIME_COUNT_EXCEEDED",
    message: `Expected ${tableName} to stay within ${limit} Quran runtime rows.`,
  });
}
