import {
  QURAN_SURAH_COUNT,
  type QuranSurahRow,
  QuranSurahRowSchema,
} from "@nakafa/aksara-contracts/quran/spec";
import {
  decodePublishedQuranSource,
  type PublishedQuranSource,
  type QuranPublicationOperation,
  QuranSnapshotChangedError,
  quranPublicationError,
} from "@repo/backend/client/quran/publication";
import { decodeQuranSurahRow } from "@repo/backend/client/quran/rows";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";

type QuranCatalogResult = FunctionReturnType<
  typeof api.contentRelease.quran.surahs
>;

/** Complete signed Quran metadata catalog in its canonical shape. */
export type PublishedQuranCatalog = PublishedQuranSource & {
  readonly surahs: readonly QuranSurahRow[];
};

interface QuranSurahProjection {
  readonly name: {
    readonly meaning: QuranSurahRow["name"]["meaning"] | null;
    readonly transliteration: string;
  };
  readonly number: number;
}

interface QuranSurahTransportProjection {
  readonly name: {
    readonly meaning: unknown;
    readonly sourceMeaning?: unknown;
    readonly transliteration: string;
  };
  readonly number: number;
}

/** Normalizes the expanded transport field into the canonical meaning shape. */
export const decodePublishedQuranSurah = Effect.fn(
  "NakafaQuran.decodePublishedSurah"
)(function* <Surah extends QuranSurahTransportProjection>(
  projection: Surah,
  operation: QuranPublicationOperation
) {
  const { sourceMeaning, ...name } = projection.name;
  if (sourceMeaning === undefined) {
    return { ...projection, name: { ...name, meaning: null } };
  }
  const meaning = yield* Schema.decodeUnknownEffect(
    QuranSurahRowSchema.fields.name.fields.meaning
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

/** Selects one surah from the exact signed snapshot used by a projection. */
export const selectPublishedQuranSurah = Effect.fn(
  "NakafaQuran.selectPublishedSurah"
)(function* (
  catalog: PublishedQuranCatalog,
  expected: {
    readonly operation: QuranPublicationOperation;
    readonly snapshotId: PublishedQuranSource["snapshotId"];
    readonly surahNumber: number;
  }
) {
  if (catalog.snapshotId !== expected.snapshotId) {
    return yield* new QuranSnapshotChangedError({
      catalogSnapshotId: catalog.snapshotId,
      operation: expected.operation,
      projectionSnapshotId: expected.snapshotId,
      reason: "Signed Quran release changed while reading its projection.",
    });
  }
  const surah = catalog.surahs[expected.surahNumber - 1];
  if (surah?.number !== expected.surahNumber) {
    return yield* quranPublicationError(
      expected.operation,
      "Signed Quran projection has no matching catalog surah."
    );
  }
  return surah;
});

/** Completes a predecessor projection only when its successor field is absent. */
export const completePublishedQuranSurah = Effect.fn(
  "NakafaQuran.completePublishedSurah"
)(function* <Surah extends QuranSurahProjection>(
  projection: Surah,
  catalog: PublishedQuranCatalog | null,
  expected: {
    readonly operation: QuranPublicationOperation;
    readonly snapshotId: PublishedQuranSource["snapshotId"];
  }
) {
  const { name: projectionName, ...surah } = projection;
  const { meaning, ...name } = projectionName;
  if (meaning !== null) {
    return {
      ...surah,
      name: { ...name, meaning },
    };
  }
  if (catalog === null) {
    return yield* quranPublicationError(
      expected.operation,
      "Signed Quran source meaning is missing."
    );
  }
  return yield* alignPublishedQuranSurah(catalog, projection, expected);
});

/** Aligns projected metadata with its canonical row from the same snapshot. */
export const alignPublishedQuranSurah = Effect.fn(
  "NakafaQuran.alignPublishedSurah"
)(function* <Surah extends QuranSurahProjection>(
  catalog: PublishedQuranCatalog,
  projection: Surah,
  expected: {
    readonly operation: QuranPublicationOperation;
    readonly snapshotId: PublishedQuranSource["snapshotId"];
  }
) {
  const source = yield* selectPublishedQuranSurah(catalog, {
    ...expected,
    surahNumber: projection.number,
  });
  const { name: projectionName, ...surah } = projection;
  const { meaning: _meaning, ...name } = projectionName;
  return {
    ...surah,
    name: { ...name, meaning: source.name.meaning },
  };
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
