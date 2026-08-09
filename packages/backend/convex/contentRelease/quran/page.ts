import {
  QURAN_SURAH_COUNT,
  type QuranSearchRow,
  QuranSearchRowSchema,
  QuranSurahRowSchema,
} from "@nakafa/aksara-contracts/quran/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { readQuranChunks } from "@repo/backend/convex/contentRelease/quran/chunks";
import { quranSearchIdentity } from "@repo/backend/convex/contentRelease/quran/facts";
import { validateQuranSurah } from "@repo/backend/convex/contentRelease/quran/input";
import { QURAN_PAGE_VERSE_LIMIT } from "@repo/backend/convex/contentRelease/quran/limits";
import { loadQuranOwner } from "@repo/backend/convex/contentRelease/quran/owner";
import { readQuranRow } from "@repo/backend/convex/contentRelease/quran/row";
import { Effect } from "effect";

/** Reads one neighboring surah metadata row when that neighbor exists. */
const readNeighbor = Effect.fn("contentRelease.readQuranNeighbor")(function* (
  ctx: QueryCtx,
  snapshotId: string,
  surahNumber: number
) {
  if (surahNumber < 1 || surahNumber > QURAN_SURAH_COUNT) {
    return null;
  }
  const row = yield* readQuranRow(
    ctx,
    snapshotId,
    `surah:${surahNumber}`,
    QuranSurahRowSchema
  );
  return row;
});

/** Loads every verified source row shared by complete and projected Quran pages. */
export const loadQuranPage = Effect.fn("contentRelease.loadQuranPage")(
  function* (
    ctx: QueryCtx,
    locale: QuranSearchRow["locale"],
    sourceSurah: number
  ) {
    const surahNumber = yield* validateQuranSurah(sourceSurah);
    const owner = yield* loadQuranOwner(ctx);
    if (owner.snapshotId === null) {
      return { owner, page: null };
    }
    const surah = yield* readQuranRow(
      ctx,
      owner.snapshotId,
      `surah:${surahNumber}`,
      QuranSurahRowSchema
    );
    if (surah.payload.numberOfVerses > QURAN_PAGE_VERSE_LIMIT) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `Quran surah ${surahNumber} exceeds ${QURAN_PAGE_VERSE_LIMIT} verses.`
      );
    }
    const { chunks, nextSurah, previousSurah } = yield* Effect.all(
      {
        chunks: readQuranChunks(ctx, {
          fromVerse: 1,
          numberOfVerses: surah.payload.numberOfVerses,
          snapshotId: owner.snapshotId,
          surahNumber,
          toVerse: surah.payload.numberOfVerses,
        }),
        nextSurah: readNeighbor(ctx, owner.snapshotId, surahNumber + 1),
        previousSurah: readNeighbor(ctx, owner.snapshotId, surahNumber - 1),
        // Keep authenticating the locale projection without returning its text.
        verifiedLocale: readQuranRow(
          ctx,
          owner.snapshotId,
          quranSearchIdentity(locale, surahNumber),
          QuranSearchRowSchema
        ),
      },
      { concurrency: "unbounded" }
    );
    return {
      owner,
      page: {
        chunks,
        nextSurah,
        previousSurah,
        surah,
      },
    };
  }
);

/** Returns one complete multilingual Quran page from the shared verified rows. */
export const readQuranPage = Effect.fn("contentRelease.readQuranPage")(
  function* (
    ctx: QueryCtx,
    locale: QuranSearchRow["locale"],
    sourceSurah: number
  ) {
    const loaded = yield* loadQuranPage(ctx, locale, sourceSurah);
    if (loaded.page === null) {
      return {
        ...loaded.owner,
        chunkJson: [],
        nextSurahJson: null,
        prevSurahJson: null,
        surahJson: null,
      };
    }

    return {
      ...loaded.owner,
      chunkJson: loaded.page.chunks.rowJson,
      nextSurahJson: loaded.page.nextSurah?.rowJson ?? null,
      prevSurahJson: loaded.page.previousSurah?.rowJson ?? null,
      surahJson: loaded.page.surah.rowJson,
    };
  }
);
