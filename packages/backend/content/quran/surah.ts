import type { PublicationRow } from "@repo/backend/content/publication/source";
import { readQuranChunks } from "@repo/backend/content/quran/chunks";
import { PublishedQuranSurahSchema } from "@repo/backend/content/quran/contract";
import { loadQuranOwner } from "@repo/backend/content/quran/owner";
import { QuranSource } from "@repo/backend/content/quran/source";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { validateQuranSurah } from "@repo/backend/convex/contentRelease/quran/input";
import { QURAN_PAGE_VERSE_LIMIT } from "@repo/backend/convex/contentRelease/quran/limits";
import { verifyQuranRow } from "@repo/backend/convex/contentRelease/quran/verify";
import { Effect, Option } from "effect";

/** Authenticates one signed surah contract. */
export const verifyQuranSurahRow = Effect.fn(
  "contentRelease.verifyQuranSurahRow"
)(function* (row: PublicationRow<"quranRows">, snapshotId: string) {
  return yield* verifyQuranRow(row, snapshotId, PublishedQuranSurahSchema);
});

/** Reads and authenticates one surah under the active signed contract. */
export const readQuranSurahRow = Effect.fn("contentRelease.readQuranSurahRow")(
  function* (snapshotId: string, surahNumber: number) {
    const source = yield* QuranSource;
    const selected = yield* source.row(snapshotId, `surah:${surahNumber}`);
    const stored = Option.getOrNull(selected);
    if (stored === null) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Active Quran row surah:${surahNumber} is unavailable.`
      );
    }
    const payload = yield* verifyQuranSurahRow(stored, snapshotId);
    return {
      index: stored.index,
      payload,
      rowHash: stored.rowHash,
      rowJson: stored.rowJson,
    };
  }
);

/** Loads and validates one active signed Quran surah metadata row. */
export const loadQuranSurah = Effect.fn("contentRelease.loadQuranSurah")(
  function* (sourceSurah: number) {
    const surahNumber = yield* validateQuranSurah(sourceSurah);
    const owner = yield* loadQuranOwner();
    if (owner.snapshotId === null) {
      return { owner, surah: null };
    }
    const surah = yield* readQuranSurahRow(owner.snapshotId, surahNumber);
    if (surah.payload.numberOfVerses > QURAN_PAGE_VERSE_LIMIT) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `Quran surah ${surahNumber} exceeds ${QURAN_PAGE_VERSE_LIMIT} verses.`
      );
    }

    return { owner, surah: { row: surah, surahNumber } };
  }
);

/** Reads one ordered verse prefix for an already validated signed surah. */
export const readQuranSurahVersePrefix = Effect.fn(
  "contentRelease.readQuranSurahVersePrefix"
)(function* (
  snapshotId: string,
  surahNumber: number,
  numberOfVerses: number,
  toVerse: number
) {
  const chunks = yield* readQuranChunks({
    fromVerse: 1,
    numberOfVerses,
    snapshotId,
    surahNumber,
    toVerse,
  });
  return chunks.rows
    .flatMap((chunk) => chunk.verses)
    .filter((verse) => verse.number.inSurah <= toVerse);
});

/** Reads the complete ordered verses for one already validated signed surah. */
export const readQuranSurahVerses = Effect.fn(
  "contentRelease.readQuranSurahVerses"
)(function* (snapshotId: string, surahNumber: number, numberOfVerses: number) {
  return yield* readQuranSurahVersePrefix(
    snapshotId,
    surahNumber,
    numberOfVerses,
    numberOfVerses
  );
});
