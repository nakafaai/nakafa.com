import {
  GitCommitShaSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { QuranRuntimeVerse } from "@nakafa/aksara-contracts/quran/snapshot/row";
import { QURAN_SURAH_COUNT } from "@nakafa/aksara-contracts/quran/spec";
import { hasExactQuranVerseRange } from "@repo/backend/client/quran/integrity";
import { quranPublicationError } from "@repo/backend/client/quran/publication";
import {
  decodeQuranChunkVerses,
  decodeQuranSearchRow,
  decodeQuranSurahRow,
  type QuranSearchRow,
} from "@repo/backend/client/quran/rows";
import {
  type LegacyQuranSurah,
  LegacyQuranSurahUpgradeSchema,
} from "@repo/backend/content/quran/upgrade";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";

type QuranCatalogResult = FunctionReturnType<
  typeof api.contentRelease.quran.surahs
>;
type QuranReferenceResult = FunctionReturnType<
  typeof api.contentRelease.quran.reference
>;

const PublishedQuranSourceSchema = Schema.Struct({
  activeManifestHash: Sha256HashSchema,
  activeReleaseId: ReleaseIdSchema,
  snapshotId: Sha256HashSchema,
  sourceRevision: GitCommitShaSchema,
});

export type PredecessorQuranSource = typeof PublishedQuranSourceSchema.Type;

/** Complete signed Quran metadata catalog in the predecessor shape. */
export interface PredecessorQuranCatalog extends PredecessorQuranSource {
  readonly surahs: readonly LegacyQuranSurah[];
}

/** One bounded signed Quran reference in the predecessor shape. */
export interface PredecessorQuranReference extends PredecessorQuranSource {
  readonly fromVerse: number;
  readonly search: QuranSearchRow;
  readonly surah: LegacyQuranSurah;
  readonly toVerse: number;
  readonly verses: readonly QuranRuntimeVerse[];
}

/** Requires the exact source identity exposed by the predecessor client. */
export const decodePredecessorQuranSource = Effect.fn(
  "NakafaQuran.decodePredecessorSource"
)(function* (
  input: {
    readonly activeManifestHash: null | string;
    readonly activeReleaseId: null | string;
    readonly managed: boolean;
    readonly snapshotId: null | string;
    readonly sourceRevision: null | string;
  },
  operation: Parameters<typeof quranPublicationError>[0]
) {
  if (!input.managed) {
    return yield* quranPublicationError(
      operation,
      "Signed Quran publication is not active."
    );
  }
  return yield* Schema.decodeUnknownEffect(PublishedQuranSourceSchema)(input, {
    onExcessProperty: "ignore",
  }).pipe(
    Effect.mapError(() =>
      quranPublicationError(
        operation,
        "Signed Quran source identity is invalid."
      )
    )
  );
});

/** Decodes the complete catalog for predecessor readers. */
export const decodePredecessorQuranCatalog = Effect.fn(
  "NakafaQuran.decodePredecessorCatalog"
)(function* (result: QuranCatalogResult) {
  const source = yield* decodePredecessorQuranSource(result, "catalog");
  const current = yield* Effect.forEach(result.rowJson, (row) =>
    decodeQuranSurahRow(row, source.snapshotId, "catalog")
  );
  const ordered = current.every((surah, index) => surah.number === index + 1);
  if (current.length !== QURAN_SURAH_COUNT || !ordered) {
    return yield* quranPublicationError(
      "catalog",
      "Signed Quran catalog is incomplete or out of order."
    );
  }
  const surahs = yield* Effect.forEach(current, (surah) =>
    encodeLegacyQuranSurah(surah, "catalog")
  );
  return { ...source, surahs } satisfies PredecessorQuranCatalog;
});

/** Decodes one bounded active signed Quran reference for predecessor readers. */
export const decodePredecessorQuranReference = Effect.fn(
  "NakafaQuran.decodePredecessorReference"
)(function* (
  result: QuranReferenceResult,
  expected: {
    readonly appLocale: AppLocaleCode;
    readonly surahNumber: number;
  }
) {
  const source = yield* decodePredecessorQuranSource(result, "reference");
  if (result.surahJson === null || result.searchJson === null) {
    return yield* quranPublicationError(
      "reference",
      "Signed Quran reference is missing."
    );
  }
  const [currentSurah, search, chunkVerses] = yield* Effect.all([
    decodeQuranSurahRow(result.surahJson, source.snapshotId, "reference"),
    decodeQuranSearchRow(result.searchJson, source.snapshotId, "reference"),
    decodeQuranChunkVerses(
      result.chunkJson,
      source.snapshotId,
      "reference",
      expected.surahNumber
    ),
  ]);
  const verses = chunkVerses.filter(
    (verse) =>
      verse.number.inSurah >= result.fromVerse &&
      verse.number.inSurah <= result.toVerse
  );
  if (
    currentSurah.number !== expected.surahNumber ||
    result.fromVerse < 1 ||
    result.toVerse > currentSurah.numberOfVerses ||
    !hasExactQuranVerseRange(verses, result.fromVerse, result.toVerse) ||
    !hasExpectedSearchIdentity(search, expected.appLocale, expected.surahNumber)
  ) {
    return yield* quranPublicationError(
      "reference",
      "Signed Quran reference identity is inconsistent."
    );
  }
  const surah = yield* encodeLegacyQuranSurah(currentSurah, "reference");
  return {
    ...source,
    fromVerse: result.fromVerse,
    search,
    surah,
    toVerse: result.toVerse,
    verses,
  } satisfies PredecessorQuranReference;
});

/** Encodes canonical metadata through the reviewed bidirectional bridge. */
const encodeLegacyQuranSurah = Effect.fn("NakafaQuran.encodeLegacySurah")(
  (
    surah: typeof LegacyQuranSurahUpgradeSchema.Type,
    operation: Parameters<typeof quranPublicationError>[0]
  ) =>
    Schema.encodeEffect(LegacyQuranSurahUpgradeSchema)(surah).pipe(
      Effect.mapError(() =>
        quranPublicationError(
          operation,
          "Quran surah cannot satisfy the predecessor contract."
        )
      )
    )
);

/** Checks the app-locale search identity returned beside one surah. */
function hasExpectedSearchIdentity(
  search: QuranSearchRow,
  appLocale: AppLocaleCode,
  surahNumber: number
) {
  return (
    search.appLocale === appLocale &&
    search.surahNumber === surahNumber &&
    search.route === `quran/${surahNumber}`
  );
}

export { QuranPublicationError } from "@repo/backend/client/quran/publication";
