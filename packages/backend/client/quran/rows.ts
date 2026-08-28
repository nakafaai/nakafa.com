import {
  QuranChunkRowSchema,
  type QuranRuntimeVerse,
  QuranSearchRowSchema,
} from "@nakafa/aksara-contracts/quran/snapshot/row";
import {
  type QuranPublicationOperation,
  quranPublicationError,
} from "@repo/backend/client/quran/publication";
import {
  PublishedQuranRowSchema,
  PublishedQuranSurahSchema,
} from "@repo/backend/content/quran/contract";
import { Effect, Schema } from "effect";

type QuranChunkRow = typeof QuranChunkRowSchema.Type;
export type QuranSearchRow = typeof QuranSearchRowSchema.Type;

/** Parses one stored signed row without weakening its runtime boundary. */
const parseQuranRow = Effect.fn("NakafaQuran.parseRow")(function* (
  source: string,
  operation: QuranPublicationOperation
) {
  return yield* Effect.try({
    catch: () =>
      quranPublicationError(operation, "Quran row is not valid JSON."),
    try: (): unknown => JSON.parse(source),
  });
});

/** Decodes one signed Quran row and verifies snapshot ownership. */
const decodeSignedQuranRow = Effect.fn("NakafaQuran.decodeSignedRow")(
  function* <A, I>(
    input: unknown,
    snapshotId: string,
    schema: Schema.Codec<A, I, never, never>,
    operation: QuranPublicationOperation
  ) {
    const row = yield* Schema.decodeUnknownEffect(PublishedQuranRowSchema)(
      input,
      { onExcessProperty: "error" }
    ).pipe(
      Effect.mapError(() =>
        quranPublicationError(
          operation,
          "Quran row failed its signed contract."
        )
      )
    );
    if (row.record.snapshotId !== snapshotId) {
      return yield* quranPublicationError(
        operation,
        "Quran row belongs to another signed snapshot."
      );
    }
    return yield* Schema.decodeUnknownEffect(schema)(row.record.payload, {
      onExcessProperty: "error",
    }).pipe(
      Effect.mapError(() =>
        quranPublicationError(
          operation,
          "Quran row failed its signed contract."
        )
      )
    );
  }
);

/** Decodes one signed surah contract into its canonical shape. */
export const decodeQuranSurahRow = Effect.fn("NakafaQuran.decodeSurahRow")(
  function* (
    source: string,
    snapshotId: string,
    operation: QuranPublicationOperation
  ) {
    const input = yield* parseQuranRow(source, operation);
    return yield* decodeSignedQuranRow(
      input,
      snapshotId,
      PublishedQuranSurahSchema,
      operation
    );
  }
);

/** Decodes one locale-indexed search row from the active signed snapshot. */
export const decodeQuranSearchRow = Effect.fn("NakafaQuran.decodeSearchRow")(
  function* (
    source: string,
    snapshotId: string,
    operation: QuranPublicationOperation
  ) {
    const input = yield* parseQuranRow(source, operation);
    return yield* decodeSignedQuranRow(
      input,
      snapshotId,
      QuranSearchRowSchema,
      operation
    );
  }
);

/** Decodes bounded chunks and returns their exact ordered verses. */
export const decodeQuranChunkVerses = Effect.fn(
  "NakafaQuran.decodeChunkVerses"
)(function* (
  sources: readonly string[],
  snapshotId: string,
  operation: QuranPublicationOperation,
  surahNumber: number
) {
  const chunks = yield* Effect.forEach(sources, (source) =>
    parseQuranRow(source, operation).pipe(
      Effect.flatMap((input) =>
        decodeSignedQuranRow(input, snapshotId, QuranChunkRowSchema, operation)
      )
    )
  );
  if (!hasContiguousChunks(chunks, surahNumber)) {
    return yield* quranPublicationError(
      operation,
      "Quran chunks are missing, out of order, or belong to another surah."
    );
  }
  return chunks.flatMap(
    (chunk: QuranChunkRow) => chunk.verses
  ) satisfies readonly QuranRuntimeVerse[];
});

/** Checks cross-chunk Quran ordering that individual row schemas cannot see. */
function hasContiguousChunks(
  chunks: readonly QuranChunkRow[],
  surahNumber: number
) {
  if (chunks.length === 0) {
    return false;
  }
  return chunks.every((chunk, index) => {
    if (chunk.surahNumber !== surahNumber) {
      return false;
    }
    if (index === 0) {
      return true;
    }
    const previous = chunks[index - 1];
    const previousVerse = previous?.verses.at(-1);
    if (!(previous && previousVerse)) {
      return false;
    }
    return (
      chunk.firstVerse === previous.lastVerse + 1 &&
      chunk.firstQuranNumber === previousVerse.number.inQuran + 1
    );
  });
}
