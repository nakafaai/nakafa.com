import {
  QURAN_SURAH_COUNT,
  type QuranSearchRow,
  QuranSearchRowSchema,
  QuranSurahRowSchema,
} from "@nakafa/aksara-contracts/quran/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { readQuranChunks } from "@repo/backend/convex/contentRelease/quran/chunks";
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
  return row.rowJson;
});

/** Loads one complete verified Quran surah page from the active snapshot. */
export const readQuranPage = Effect.fn("contentRelease.readQuranPage")(
  function* (
    ctx: QueryCtx,
    locale: QuranSearchRow["locale"],
    sourceSurah: number
  ) {
    const surahNumber = yield* validateQuranSurah(sourceSurah);
    const owner = yield* loadQuranOwner(ctx);
    if (owner.snapshotId === null) {
      return {
        ...owner,
        chunkJson: [],
        nextSurahJson: null,
        prevSurahJson: null,
        searchJson: null,
        surahJson: null,
      };
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
    const chunks = yield* readQuranChunks(ctx, {
      fromVerse: 1,
      numberOfVerses: surah.payload.numberOfVerses,
      snapshotId: owner.snapshotId,
      surahNumber,
      toVerse: surah.payload.numberOfVerses,
    });
    const search = yield* readQuranRow(
      ctx,
      owner.snapshotId,
      `search:${locale}:${surahNumber}`,
      QuranSearchRowSchema
    );
    const [prevSurahJson, nextSurahJson] = yield* Effect.all([
      readNeighbor(ctx, owner.snapshotId, surahNumber - 1),
      readNeighbor(ctx, owner.snapshotId, surahNumber + 1),
    ]);
    return {
      ...owner,
      chunkJson: chunks.rowJson,
      nextSurahJson,
      prevSurahJson,
      searchJson: search.rowJson,
      surahJson: surah.rowJson,
    };
  }
);
