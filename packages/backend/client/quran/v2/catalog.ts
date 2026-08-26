import {
  QURAN_SURAH_COUNT,
  type QuranSurahRow,
} from "@nakafa/aksara-contracts/quran/spec";
import { quranPublicationError } from "@repo/backend/client/quran/publication";
import { decodeQuranSurahRow } from "@repo/backend/client/quran/rows";
import {
  decodePublishedQuranSourceV2,
  type PublishedQuranSourceV2,
} from "@repo/backend/client/quran/v2/publication";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";

type QuranCatalogResult = FunctionReturnType<
  typeof api.contentRelease.quran.surahs
>;

/** Complete signed Quran metadata catalog in the canonical V2 shape. */
export type PublishedQuranCatalogV2 = PublishedQuranSourceV2 & {
  readonly surahs: readonly QuranSurahRow[];
};

/** Decodes the complete active signed Quran metadata catalog as V2. */
export const decodePublishedQuranCatalogV2 = Effect.fn(
  "NakafaQuran.decodeCatalogV2"
)(function* (result: QuranCatalogResult) {
  const source = yield* decodePublishedQuranSourceV2(result, "catalog");
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
  return { ...source, surahs } satisfies PublishedQuranCatalogV2;
});
