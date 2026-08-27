import {
  QURAN_SURAH_COUNT,
  type QuranSurahRow,
} from "@nakafa/aksara-contracts/quran/spec";
import {
  decodePublishedQuranSource,
  type PublishedQuranSource,
  type QuranPublicationOperation,
  quranPublicationError,
} from "@repo/backend/client/quran/publication";
import { decodeQuranSurahRow } from "@repo/backend/client/quran/rows";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";

type QuranCatalogResult = FunctionReturnType<
  typeof api.contentRelease.quran.surahs
>;

/** Complete signed Quran metadata catalog in its canonical shape. */
export type PublishedQuranCatalog = PublishedQuranSource & {
  readonly surahs: readonly QuranSurahRow[];
};

interface QuranSurahProjection {
  readonly name: {
    readonly meaning: unknown;
    readonly transliteration: string;
  };
  readonly number: number;
}

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
    return yield* quranPublicationError(
      expected.operation,
      "Signed Quran catalog and projection snapshots do not match."
    );
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
  return {
    ...projection,
    name: { ...projection.name, meaning: source.name.meaning },
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
