import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import type { Locale } from "@repo/contents/_types/content";
import { createLearningGraphIdentity } from "@repo/contents/_types/learning-graph";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentSync/mutations/quran", () => {
  it("preserves other-locale Quran route rows during locale-scoped stale cleanup", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentRoutes", {
        ...quranRouteGraph("id", "quran/1"),
        authors: [],
        contentHash: "id-current",
        kind: "quran-surah",
        locale: "id",
        markdown: true,
        route: "quran/1",
        section: "quran",
        syncedAt: 1,
        title: "Al-Fatihah",
      });
      await ctx.db.insert("contentRoutes", {
        ...quranRouteGraph("id", "quran/999"),
        authors: [],
        contentHash: "id-stale",
        kind: "quran-surah",
        locale: "id",
        markdown: true,
        route: "quran/999",
        section: "quran",
        syncedAt: 1,
        title: "Stale",
      });
      await ctx.db.insert("contentRoutes", {
        ...quranRouteGraph("en", "quran/1"),
        authors: [],
        contentHash: "en-current",
        kind: "quran-surah",
        locale: "en",
        markdown: true,
        route: "quran/1",
        section: "quran",
        syncedAt: 1,
        title: "Al-Faatiha",
      });
    });

    const deleted = await t.mutation(
      internal.contentSync.mutations.quran.deleteStaleQuranRuntime,
      {
        locales: ["id"],
        surahNumbers: [1],
        verseKeys: [],
      }
    );
    const routes = await t.query(
      async (ctx) =>
        await ctx.db
          .query("contentRoutes")
          .withIndex("by_kind", (q) => q.eq("kind", "quran-surah"))
          .collect()
    );

    expect(deleted.routesDeleted).toBe(1);
    expect(routes.map((route) => route.content_id).sort()).toEqual([
      "asset:en:quran:quran-surah:1",
      "asset:id:quran:quran-surah:1",
    ]);
  });

  it("cleans stale Quran verses by surah-local identity", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await ctx.db.insert("quranVerses", quranVerse({ quranNumber: 1 }));
      await ctx.db.insert(
        "quranVerses",
        quranVerse({ quranNumber: 1000, surahNumber: 1, verseNumber: 2 })
      );
      await ctx.db.insert(
        "quranVerses",
        quranVerse({ quranNumber: 1000, surahNumber: 2 })
      );
    });

    const deleted = await t.mutation(
      internal.contentSync.mutations.quran.deleteStaleQuranRuntime,
      {
        cleanupSurahNumbers: [1],
        locales: ["id"],
        surahNumbers: [1, 2],
        verseKeys: [
          { surahNumber: 1, verseNumber: 1 },
          { surahNumber: 2, verseNumber: 1 },
        ],
      }
    );
    const verses = await t.query(
      async (ctx) => await ctx.db.query("quranVerses").collect()
    );

    expect(deleted.versesDeleted).toBe(1);
    expect(
      verses.map((verse) => `${verse.surahNumber}:${verse.verseNumber}`).sort()
    ).toEqual(["1:1", "2:1"]);
  });
});

/** Builds graph IDs for one Quran route fixture. */
function quranRouteGraph(locale: Locale, route: string) {
  const identity = createLearningGraphIdentity({
    kind: "quran-surah",
    locale,
    route,
  });

  return {
    ...identity,
    content_id: identity.assetId,
  };
}

/** Builds one Quran verse row for stale cleanup tests. */
function quranVerse({
  quranNumber,
  surahNumber = 1,
  verseNumber = 1,
}: {
  quranNumber: number;
  surahNumber?: number;
  verseNumber?: number;
}) {
  return {
    audio: { primary: "primary.mp3", secondary: [] },
    contentHash: `${surahNumber}:${verseNumber}`,
    hizbQuarter: 1,
    juz: 1,
    manzil: 1,
    page: 1,
    quranNumber,
    ruku: 1,
    sajdaObligatory: false,
    sajdaRecommended: false,
    surahNumber,
    syncedAt: 1,
    tafsir: {
      id: {
        long: "Long tafsir",
        short: "Short tafsir",
      },
    },
    text: {
      arab: "Text",
      transliteration: {
        en: "Text",
      },
    },
    translation: {
      en: "Translation",
      id: "Terjemahan",
    },
    verseNumber,
  };
}
