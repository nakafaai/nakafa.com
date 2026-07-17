import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { readQuranMetadata } from "@repo/contents/_lib/quran";
import type { Locale } from "@repo/contents/_types/content";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { locales } from "@repo/utilities/locales";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

type CatalogQuranProjection = Pick<
  Doc<"contentSearch">,
  | "alignmentId"
  | "assetId"
  | "conceptId"
  | "content_id"
  | "learningObjectId"
  | "lensId"
  | "locale"
  | "route"
  | "section"
  | "sourcePath"
>;

describe("contentSync/mutations/quran", () => {
  it("removes rows beyond the complete localized Quran corpus", async () => {
    const t = convexTest(schema, convexModules);
    const surahs = await Effect.runPromise(readQuranMetadata());
    const surahNumbers = Array.from({ length: 114 }, (_, index) => index + 1);

    await t.mutation(async (ctx) => {
      for (const surah of surahs) {
        await ctx.db.insert("quranSurahs", {
          ...surah,
          contentHash: `surah:${surah.number}`,
          syncedAt: 1,
        });
      }

      await ctx.db.insert("quranSurahs", {
        ...surahs[0],
        contentHash: "surah:stale",
        number: 999,
        syncedAt: 1,
      });

      for (const locale of locales) {
        for (const surahNumber of surahNumbers) {
          await insertQuranRoute(ctx, {
            locale,
            route: `quran/${surahNumber}`,
            title: `${surahNumber}`,
          });
        }
      }

      await insertQuranRoute(ctx, {
        locale: locales[0],
        route: "quran/999",
        title: "Stale",
      });
    });

    const deleted = await t.mutation(
      internal.contentSync.mutations.quran.deleteStaleQuranRuntime,
      { locales: [...locales], surahNumbers, verseKeys: [] }
    );

    expect(deleted).toMatchObject({ routesDeleted: 1, surahsDeleted: 1 });
  });

  it("preserves current graph identities and locales outside cleanup scope", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      const current = catalogQuranProjection("id", "quran/1");
      const stale = catalogQuranProjection("id", "quran/999");

      await insertQuranRoute(ctx, {
        locale: "id",
        projection: current,
        route: "quran/1",
        title: "Al-Fatihah",
      });
      await ctx.db.insert("contentSearch", {
        ...quranSearchDocument(current, "Al-Fatihah"),
        contentHash: "current-hash",
      });
      await insertQuranRoute(ctx, {
        locale: "id",
        projection: stale,
        route: "quran/999",
        title: "Stale Surah",
      });
      await ctx.db.insert("contentSearch", {
        ...quranSearchDocument(stale, "Stale Surah"),
        contentHash: "stale-hash",
      });
      await insertQuranRoute(ctx, {
        locale: "en",
        route: "quran/1",
        title: "Al-Faatiha",
      });
    });

    const deleted = await t.mutation(
      internal.contentSync.mutations.quran.deleteStaleQuranRuntime,
      { locales: ["id"], surahNumbers: [1], verseKeys: [] }
    );
    const projections = await t.query(async (ctx) => {
      const routes = await ctx.db
        .query("contentRoutes")
        .withIndex("by_kind", (q) => q.eq("kind", "quran-surah"))
        .collect();
      const searchRows = await ctx.db
        .query("contentSearch")
        .withIndex("by_locale_and_section_and_title", (q) =>
          q.eq("locale", "id").eq("section", "quran")
        )
        .collect();

      return { routes, searchRows };
    });

    expect(deleted).toMatchObject({ routesDeleted: 1, searchDeleted: 1 });
    expect(projections.routes.map((row) => row.content_id).sort()).toEqual([
      "asset:en:quran:quran-surah:1",
      "asset:id:catalog:quran:1",
    ]);
    expect(projections.searchRows.map((row) => row.content_id)).toEqual([
      "asset:id:catalog:quran:1",
    ]);
  });

  it("cleans stale verses by surah-local identity", async () => {
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

/** Inserts one Quran route using its supplied or route-derived graph identity. */
async function insertQuranRoute(
  ctx: MutationCtx,
  args: {
    locale: Locale;
    projection?: CatalogQuranProjection;
    route: string;
    title: string;
  }
) {
  const projection =
    args.projection ?? quranRouteGraph(args.locale, args.route);

  await ctx.db.insert("contentRoutes", {
    ...projection,
    authors: [],
    contentHash: `${args.locale}:${args.route}`,
    kind: "quran-surah",
    locale: args.locale,
    markdown: true,
    route: args.route,
    section: "quran",
    syncedAt: 1,
    title: args.title,
  });
}

/** Builds graph IDs for one Quran route fixture. */
function quranRouteGraph(locale: Locale, route: string) {
  const identity = createLearningGraphIdentityFromRoute({ locale, route });

  if (!identity) {
    throw new Error(`Expected Quran route graph fixture for ${route}.`);
  }

  return { ...identity, content_id: identity.assetId, sourcePath: route };
}

/** Builds a catalog-owned Quran graph projection fixture. */
function catalogQuranProjection(
  locale: Locale,
  route: string
): CatalogQuranProjection {
  const surah = route.split("/").at(-1) ?? "unknown";
  const assetId = `asset:${locale}:catalog:quran:${surah}`;

  return {
    alignmentId: `alignment:catalog:quran:${surah}`,
    assetId,
    conceptId: `concept:catalog:quran:${surah}`,
    content_id: assetId,
    learningObjectId: `lo:catalog:quran:${surah}`,
    lensId: "lens:catalog:quran",
    locale,
    route,
    section: "quran",
    sourcePath: route,
  };
}

/** Builds one Quran search row from a persisted graph projection fixture. */
function quranSearchDocument(
  projection: CatalogQuranProjection,
  title: string
) {
  return {
    ...projection,
    description: title,
    markdown_url: `https://nakafa.com/${projection.locale}/${projection.route}.md`,
    syncedAt: 1,
    text: title,
    title,
    url: `https://nakafa.com/${projection.locale}/${projection.route}`,
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
    tafsir: { id: { short: "Short tafsir" } },
    text: { arab: "Text", transliteration: { en: "Text" } },
    translation: { en: "Translation", id: "Terjemahan" },
    verseNumber,
  };
}
