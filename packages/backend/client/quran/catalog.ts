import { QURAN_SURAH_COUNT } from "@nakafa/aksara-contracts/quran/spec";
import {
  decodePublishedQuranSource,
  type PublishedQuranSource,
  type QuranPublicationOperation,
  quranPublicationError,
} from "@repo/backend/client/quran/publication";
import { decodeQuranSurahRow } from "@repo/backend/client/quran/rows";
import {
  PublishedQuranMeaningSchema,
  type PublishedQuranSurah,
} from "@repo/backend/content/quran/contract";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";

type QuranCatalogResult = FunctionReturnType<
  typeof api.contentRelease.quran.surahs
>;

/** Complete signed Quran metadata catalog in its canonical shape. */
export type PublishedQuranCatalog = PublishedQuranSource & {
  readonly surahs: readonly PublishedQuranSurah[];
};

interface QuranSurahTransportProjection {
  readonly name: {
    readonly sourceMeaning: unknown;
    readonly transliteration: string;
  };
  readonly number: number;
}

/** Normalizes the source transport field into the canonical meaning shape. */
export const decodePublishedQuranSurah = Effect.fn(
  "NakafaQuran.decodePublishedSurah"
)(function* <Surah extends QuranSurahTransportProjection>(
  projection: Surah,
  operation: QuranPublicationOperation
) {
  const { sourceMeaning, ...name } = projection.name;
  const meaning = yield* Schema.decodeUnknownEffect(
    PublishedQuranMeaningSchema
  )(sourceMeaning).pipe(
    Effect.mapError(() =>
      quranPublicationError(
        operation,
        "Signed Quran source meaning is invalid."
      )
    )
  );
  return { ...projection, name: { ...name, meaning } };
});

/** Decodes the complete active signed Quran metadata catalog. */
export const decodePublishedQuranCatalog = Effect.fn(
  "NakafaQuran.decodeCatalog"
)(function* (result: QuranCatalogResult) {
  const source = yield* decodePublishedQuranSource(result, "catalog");
  const surahs = yield* Effect.forEach(result.rowJson, (row) =>
    decodeQuranSurahRow(row, source.snapshotId, "catalog")
  );
  const ordered = surahs.every((surah, index) => surah.number === index + 1);
  if (surahs.length !== QURAN_SURAH_COUNT || !ordered) {
    return yield* quranPublicationError(
      "catalog",
      "Signed Quran catalog is incomplete or out of order."
    );
  }
  return { ...source, surahs } satisfies PublishedQuranCatalog;
});
