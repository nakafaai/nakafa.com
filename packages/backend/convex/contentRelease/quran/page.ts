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

/** Loads the active signed surah shared by complete and projected pages. */
const loadQuranPageSource = Effect.fn("contentRelease.loadQuranPageSource")(
  function* (ctx: QueryCtx, sourceSurah: number) {
    const surahNumber = yield* validateQuranSurah(sourceSurah);
    const owner = yield* loadQuranOwner(ctx);
    if (owner.snapshotId === null) {
      return { owner, source: null };
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
    return { owner, source: { surah, surahNumber } };
  }
);

/** Reads only the signed rows required by both complete and projected pages. */
const readQuranPageRows = Effect.fn("contentRelease.readQuranPageRows")(
  function* (
    ctx: QueryCtx,
    snapshotId: string,
    surahNumber: number,
    numberOfVerses: number
  ) {
    return yield* Effect.all(
      {
        chunks: readQuranChunks(ctx, {
          fromVerse: 1,
          numberOfVerses,
          snapshotId,
          surahNumber,
          toVerse: numberOfVerses,
        }),
        nextSurah: readNeighbor(ctx, snapshotId, surahNumber + 1),
        previousSurah: readNeighbor(ctx, snapshotId, surahNumber - 1),
      },
      { concurrency: "unbounded" }
    );
  }
);

/** Loads the narrow signed page source without an unrelated search document. */
export const loadQuranPageView = Effect.fn("contentRelease.loadQuranPageView")(
  function* (ctx: QueryCtx, sourceSurah: number) {
    const loaded = yield* loadQuranPageSource(ctx, sourceSurah);
    if (loaded.source === null || loaded.owner.snapshotId === null) {
      return { owner: loaded.owner, page: null };
    }
    const rows = yield* readQuranPageRows(
      ctx,
      loaded.owner.snapshotId,
      loaded.source.surahNumber,
      loaded.source.surah.payload.numberOfVerses
    );
    return {
      owner: loaded.owner,
      page: { ...rows, surah: loaded.source.surah },
    };
  }
);

/** Returns one complete multilingual page through the existing wire contract. */
export const readQuranPage = Effect.fn("contentRelease.readQuranPage")(
  function* (
    ctx: QueryCtx,
    locale: QuranSearchRow["locale"],
    sourceSurah: number
  ) {
    const loaded = yield* loadQuranPageSource(ctx, sourceSurah);
    if (loaded.source === null || loaded.owner.snapshotId === null) {
      return {
        ...loaded.owner,
        chunkJson: [],
        nextSurahJson: null,
        prevSurahJson: null,
        searchJson: null,
        surahJson: null,
      };
    }
    const { rows, search } = yield* Effect.all(
      {
        rows: readQuranPageRows(
          ctx,
          loaded.owner.snapshotId,
          loaded.source.surahNumber,
          loaded.source.surah.payload.numberOfVerses
        ),
        search: readQuranRow(
          ctx,
          loaded.owner.snapshotId,
          quranSearchIdentity(locale, loaded.source.surahNumber),
          QuranSearchRowSchema
        ),
      },
      { concurrency: "unbounded" }
    );

    return {
      ...loaded.owner,
      chunkJson: rows.chunks.rowJson,
      nextSurahJson: rows.nextSurah?.rowJson ?? null,
      prevSurahJson: rows.previousSurah?.rowJson ?? null,
      searchJson: search.rowJson,
      surahJson: loaded.source.surah.rowJson,
    };
  }
);
