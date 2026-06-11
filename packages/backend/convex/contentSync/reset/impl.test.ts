import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { deleteBatchFromTable } from "./impl";

describe("contentSync/reset/impl", () => {
  it("deletes route and Quran runtime rows through bounded reset batches", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(seedDerivedRuntimeRows);

    const routeDelete = await t.mutation(deleteContentRoutesBatch);
    const verseDelete = await t.mutation(deleteQuranVersesBatch);
    const surahDelete = await t.mutation(deleteQuranSurahsBatch);
    const counts = await t.query(getDerivedRuntimeRows);

    expect(routeDelete).toEqual({ deleted: 1, hasMore: false });
    expect(verseDelete).toEqual({ deleted: 1, hasMore: false });
    expect(surahDelete).toEqual({ deleted: 1, hasMore: false });
    expect(counts).toEqual({ routes: [], surahs: [], verses: [] });
  });
});

/** Seeds the content-derived runtime rows newly managed by reset. */
async function seedDerivedRuntimeRows(ctx: MutationCtx) {
  await ctx.db.insert("contentRoutes", {
    authors: [],
    contentHash: "route-hash",
    content_id: "id/quran/1",
    kind: "quran-surah",
    locale: "id",
    markdown: true,
    route: "quran/1",
    section: "quran",
    syncedAt: 1,
    title: "Al-Fatihah",
  });
  await ctx.db.insert("quranSurahs", {
    contentHash: "surah-hash",
    name: {
      long: "Al-Fatihah",
      short: "الفاتحة",
      translation: { en: "The Opening", id: "Pembukaan" },
      transliteration: { en: "Al-Fatihah", id: "Al-Fatihah" },
    },
    number: 1,
    numberOfVerses: 1,
    preBismillah: null,
    revelation: { arab: "مكية", en: "Meccan", id: "Makkiyah" },
    sequence: 5,
    syncedAt: 1,
  });
  await ctx.db.insert("quranVerses", {
    audio: { primary: "https://example.test/1.mp3", secondary: [] },
    contentHash: "verse-hash",
    hizbQuarter: 1,
    juz: 1,
    manzil: 1,
    page: 1,
    quranNumber: 1,
    ruku: 1,
    sajdaObligatory: false,
    sajdaRecommended: false,
    surahNumber: 1,
    syncedAt: 1,
    tafsir: { id: { long: "Tafsir panjang", short: "Tafsir pendek" } },
    text: { arab: "بسم الله", transliteration: { en: "Bismillah" } },
    translation: { en: "In the name of Allah", id: "Dengan nama Allah" },
    verseNumber: 1,
  });
}

/** Deletes one content route reset batch through the shared reset helper. */
async function deleteContentRoutesBatch(ctx: MutationCtx) {
  return await deleteBatchFromTable(ctx, "contentRoutes");
}

/** Deletes one Quran verse reset batch through the shared reset helper. */
async function deleteQuranVersesBatch(ctx: MutationCtx) {
  return await deleteBatchFromTable(ctx, "quranVerses");
}

/** Deletes one Quran surah reset batch through the shared reset helper. */
async function deleteQuranSurahsBatch(ctx: MutationCtx) {
  return await deleteBatchFromTable(ctx, "quranSurahs");
}

/** Reads the derived runtime tables after reset has run. */
async function getDerivedRuntimeRows(ctx: QueryCtx) {
  return {
    routes: await ctx.db.query("contentRoutes").collect(),
    surahs: await ctx.db.query("quranSurahs").collect(),
    verses: await ctx.db.query("quranVerses").collect(),
  };
}
