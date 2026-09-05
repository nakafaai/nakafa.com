import { QuranChunkRowSchema } from "@nakafa/aksara-contracts/quran/snapshot/row";
import { QURAN_CHUNK_SIZE } from "@nakafa/aksara-contracts/quran/spec";
import { QuranSource } from "@repo/backend/content/quran/source";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { QURAN_PAGE_CHUNK_LIMIT } from "@repo/backend/convex/contentRelease/quran/limits";
import { verifyQuranRow } from "@repo/backend/convex/contentRelease/quran/verify";
import { Effect } from "effect";

type QuranChunkRow = typeof QuranChunkRowSchema.Type;

interface QuranChunkInput {
  readonly fromVerse: number;
  readonly numberOfVerses: number;
  readonly snapshotId: string;
  readonly surahNumber: number;
  readonly toVerse: number;
}

/** Returns the first immutable chunk boundary containing one verse. */
function chunkStart(verseNumber: number) {
  return (
    Math.floor((verseNumber - 1) / QURAN_CHUNK_SIZE) * QURAN_CHUNK_SIZE + 1
  );
}

/** Checks cross-chunk order against one signed surah boundary. */
function hasCoherentChunks(
  chunks: readonly QuranChunkRow[],
  input: QuranChunkInput
) {
  const firstChunk = chunkStart(input.fromVerse);
  let expectedFirstQuranNumber: number | undefined;
  return chunks.every((chunk, index) => {
    const expectedFirstVerse = firstChunk + index * QURAN_CHUNK_SIZE;
    const expectedLastVerse = Math.min(
      expectedFirstVerse + QURAN_CHUNK_SIZE - 1,
      input.numberOfVerses
    );
    const continuous =
      expectedFirstQuranNumber === undefined ||
      chunk.firstQuranNumber === expectedFirstQuranNumber;
    const coherent =
      chunk.surahNumber === input.surahNumber &&
      chunk.firstVerse === expectedFirstVerse &&
      chunk.lastVerse === expectedLastVerse &&
      continuous;
    expectedFirstQuranNumber = chunk.firstQuranNumber + chunk.verses.length;
    return coherent;
  });
}

/** Reads and authenticates only the chunks covering one bounded verse range. */
export const readQuranChunks = Effect.fn("contentRelease.readQuranChunks")(
  function* (input: QuranChunkInput) {
    const firstChunk = chunkStart(input.fromVerse);
    const lastChunk = chunkStart(input.toVerse);
    const expectedCount = (lastChunk - firstChunk) / QURAN_CHUNK_SIZE + 1;
    if (expectedCount > QURAN_PAGE_CHUNK_LIMIT) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `Quran page exceeds ${QURAN_PAGE_CHUNK_LIMIT} runtime chunks.`
      );
    }
    const source = yield* QuranSource;
    const stored = yield* source.chunks(
      input.snapshotId,
      input.surahNumber,
      firstChunk,
      lastChunk,
      expectedCount + 1
    );
    if (stored.length !== expectedCount) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Quran surah ${input.surahNumber} has an incomplete chunk range.`
      );
    }
    const chunks = yield* Effect.forEach(stored, (row) =>
      verifyQuranRow(row, input.snapshotId, QuranChunkRowSchema)
    );
    if (!hasCoherentChunks(chunks, input)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Quran surah ${input.surahNumber} changed its cross-chunk sequence.`
      );
    }
    return {
      rowJson: stored.map(({ rowJson }) => rowJson),
      rows: chunks,
    };
  }
);
