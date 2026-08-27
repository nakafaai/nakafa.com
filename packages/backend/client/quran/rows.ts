import {
  QuranChunkRowSchema,
  type QuranRuntimeVerse,
  QuranSearchRowSchema,
} from "@nakafa/aksara-contracts/quran/snapshot/row";
import { QuranSurahRowSchema } from "@nakafa/aksara-contracts/quran/spec";
import { ContentSnapshotRowSchema } from "@nakafa/aksara-contracts/release/snapshot/data";
import { ContentSnapshotRowSchema as LegacyContentSnapshotRowSchema } from "@nakafa/aksara-v151/release/snapshot/data";
import {
  type QuranPublicationOperation,
  quranPublicationError,
} from "@repo/backend/client/quran/publication";
import { LegacyQuranSurahUpgradeSchema } from "@repo/backend/content/quran/upgrade";
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

/** Decodes one current signed Quran row and verifies snapshot ownership. */
const decodeCurrentQuranRow = Effect.fn("NakafaQuran.decodeCurrentRow")(
  function* <A, I>(
    input: unknown,
    snapshotId: string,
    schema: Schema.Codec<A, I, never, never>,
    operation: QuranPublicationOperation
  ) {
    const row = yield* Schema.decodeUnknownEffect(ContentSnapshotRowSchema)(
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
    if (row.family !== "quran" || row.record.snapshotId !== snapshotId) {
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

/** Decodes one legacy surah into the canonical current representation. */
const decodeLegacySurah = Effect.fn("NakafaQuran.decodeLegacySurah")(function* (
  input: unknown,
  snapshotId: string,
  operation: QuranPublicationOperation
) {
  const row = yield* Schema.decodeUnknownEffect(LegacyContentSnapshotRowSchema)(
    input,
    { onExcessProperty: "error" }
  ).pipe(
    Effect.mapError(() =>
      quranPublicationError(
        operation,
        "Quran row failed its legacy signed contract."
      )
    )
  );
  if (row.family !== "quran" || row.record.snapshotId !== snapshotId) {
    return yield* quranPublicationError(
      operation,
      "Quran row belongs to another signed snapshot."
    );
  }
  return yield* Schema.decodeUnknownEffect(LegacyQuranSurahUpgradeSchema)(
    row.record.payload,
    { onExcessProperty: "error" }
  ).pipe(
    Effect.mapError(() =>
      quranPublicationError(
        operation,
        "Quran row failed its legacy signed contract."
      )
    )
  );
});

/** Decodes either supported signed surah contract into the canonical shape. */
export const decodeQuranSurahRow = Effect.fn("NakafaQuran.decodeSurahRow")(
  function* (
    source: string,
    snapshotId: string,
    operation: QuranPublicationOperation
  ) {
    const input = yield* parseQuranRow(source, operation);
    return yield* decodeCurrentQuranRow(
      input,
      snapshotId,
      QuranSurahRowSchema,
      operation
    ).pipe(
      Effect.catchTag("QuranPublicationError", () =>
        decodeLegacySurah(input, snapshotId, operation)
      )
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
    return yield* decodeCurrentQuranRow(
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
        decodeCurrentQuranRow(input, snapshotId, QuranChunkRowSchema, operation)
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
