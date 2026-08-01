import {
  QURAN_SURAH_COUNT,
  type QuranSearchRow,
  QuranSearchRowSchema,
  QuranSurahRowSchema,
} from "@nakafa/aksara-contracts/quran/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadQuranOwner } from "@repo/backend/convex/contentRelease/quran/owner";
import { verifyQuranRow } from "@repo/backend/convex/contentRelease/quran/verify";
import { Effect } from "effect";

/** Loads and authenticates the complete ordered Quran surah catalog. */
const loadQuranCatalog = Effect.fn("contentRelease.loadQuranCatalog")(
  function* (ctx: QueryCtx) {
    const owner = yield* loadQuranOwner(ctx);
    if (owner.snapshotId === null) {
      return { owner, stored: null };
    }
    const stored = yield* Effect.promise(() =>
      ctx.db
        .query("quranRows")
        .withIndex(
          "by_snapshotId_and_kind_and_surahNumber_and_firstVerse",
          (index) =>
            index.eq("snapshotId", owner.snapshotId).eq("kind", "quran-surah")
        )
        .take(QURAN_SURAH_COUNT + 1)
    );
    if (stored.length !== QURAN_SURAH_COUNT) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Active Quran catalog does not contain exactly 114 surahs."
      );
    }
    const surahs = yield* Effect.forEach(stored, (row) =>
      verifyQuranRow(row, owner.snapshotId, QuranSurahRowSchema)
    );
    const invalid = surahs.find((surah, index) => surah.number !== index + 1);
    if (invalid) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Active Quran catalog lost its canonical surah order."
      );
    }
    return { owner, stored, surahs };
  }
);

/** Loads the complete signed route catalog for one Quran locale. */
const loadQuranRoutes = Effect.fn("contentRelease.loadQuranRoutes")(function* (
  ctx: QueryCtx,
  locale: QuranSearchRow["locale"]
) {
  const owner = yield* loadQuranOwner(ctx);
  if (owner.snapshotId === null) {
    return { owner, routes: null };
  }
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("quranRows")
      .withIndex("by_snapshotId_and_kind_and_locale_and_surahNumber", (index) =>
        index
          .eq("snapshotId", owner.snapshotId)
          .eq("kind", "quran-search")
          .eq("locale", locale)
      )
      .take(QURAN_SURAH_COUNT + 1)
  );
  if (stored.length !== QURAN_SURAH_COUNT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active Quran route catalog for ${locale} does not contain exactly 114 surahs.`
    );
  }
  const routes = yield* Effect.forEach(stored, (row) =>
    verifyQuranRow(row, owner.snapshotId, QuranSearchRowSchema)
  );
  const invalid = routes.find(
    (route, index) =>
      route.surahNumber !== index + 1 || route.route !== `quran/${index + 1}`
  );
  if (invalid) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active Quran route catalog for ${locale} lost its canonical surah order.`
    );
  }
  return { owner, routes };
});

/** Returns all verified Quran metadata rows without loading verse bodies. */
export const readQuranSurahs = Effect.fn("contentRelease.readQuranSurahs")(
  function* (ctx: QueryCtx) {
    const catalog = yield* loadQuranCatalog(ctx);
    if (catalog.stored === null) {
      return {
        ...catalog.owner,
        rowJson: [],
      };
    }
    return {
      ...catalog.owner,
      rowJson: catalog.stored.map(({ rowJson }) => rowJson),
    };
  }
);

/** Returns canonical Quran sitemap paths from signed localized route rows. */
export const readQuranSitemap = Effect.fn("contentRelease.readQuranSitemap")(
  function* (ctx: QueryCtx, locale: QuranSearchRow["locale"]) {
    const catalog = yield* loadQuranRoutes(ctx, locale);
    if (catalog.routes === null) {
      return { ...catalog.owner, locale, routes: [] };
    }
    return {
      ...catalog.owner,
      locale,
      routes: catalog.routes.map(({ route }) => route),
    };
  }
);
