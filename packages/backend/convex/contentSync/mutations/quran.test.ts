import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentSync/mutations/quran", () => {
  it("preserves other-locale Quran route rows during locale-scoped stale cleanup", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentRoutes", {
        authors: [],
        contentHash: "id-current",
        content_id: "id/quran/1",
        kind: "quran-surah",
        locale: "id",
        markdown: true,
        route: "quran/1",
        section: "quran",
        syncedAt: 1,
        title: "Al-Fatihah",
      });
      await ctx.db.insert("contentRoutes", {
        authors: [],
        contentHash: "id-stale",
        content_id: "id/quran/999",
        kind: "quran-surah",
        locale: "id",
        markdown: true,
        route: "quran/999",
        section: "quran",
        syncedAt: 1,
        title: "Stale",
      });
      await ctx.db.insert("contentRoutes", {
        authors: [],
        contentHash: "en-current",
        content_id: "en/quran/1",
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
      "en/quran/1",
      "id/quran/1",
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
