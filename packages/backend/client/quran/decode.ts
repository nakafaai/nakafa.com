import {
  GitCommitShaSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import {
  QuranChunkRowSchema,
  type QuranRuntimeVerse,
  QuranSearchRowSchema,
} from "@nakafa/aksara-contracts/quran/snapshot/row";
import {
  QURAN_SURAH_COUNT,
  type QuranSurahRow,
  QuranSurahRowSchema,
} from "@nakafa/aksara-contracts/quran/spec";
import { ContentSnapshotRowSchema } from "@nakafa/aksara-contracts/release/snapshot/data";
import { hasExactQuranVerseRange } from "@repo/backend/client/quran/integrity";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";

type QuranCatalogResult = FunctionReturnType<
  typeof api.contentRelease.quran.surahs
>;
type QuranReferenceResult = FunctionReturnType<
  typeof api.contentRelease.quran.reference
>;
type QuranChunkRow = typeof QuranChunkRowSchema.Type;
type QuranSearchRow = typeof QuranSearchRowSchema.Type;
const QuranPublicationOperationSchema = Schema.Literals([
  "attribution",
  "catalog",
  "document",
  "interpretation",
  "markdown",
  "reference",
  "view",
]);
type QuranPublicationOperation = typeof QuranPublicationOperationSchema.Type;
const PublishedQuranSourceSchema = Schema.Struct({
  activeManifestHash: Sha256HashSchema,
  activeReleaseId: ReleaseIdSchema,
  snapshotId: Sha256HashSchema,
  sourceRevision: GitCommitShaSchema,
});
export type PublishedQuranSource = typeof PublishedQuranSourceSchema.Type;
/** One signed Quran response failed its exact publication contract. */
export class QuranPublicationError extends Schema.TaggedError<QuranPublicationError>()(
  "QuranPublicationError",
  {
    operation: QuranPublicationOperationSchema,
    reason: Schema.String,
  }
) {}
/** Complete signed Quran metadata catalog and its immutable source identity. */
export interface PublishedQuranCatalog extends PublishedQuranSource {
  readonly surahs: readonly QuranSurahRow[];
}
/** One bounded signed Quran reference and its app-locale graph identity. */
export interface PublishedQuranReference extends PublishedQuranSource {
  readonly fromVerse: number;
  readonly search: QuranSearchRow;
  readonly surah: QuranSurahRow;
  readonly toVerse: number;
  readonly verses: readonly QuranRuntimeVerse[];
}
/** Creates one domain failure for malformed or inactive signed Quran data. */
function publicationError(
  operation: QuranPublicationOperation,
  reason: string
) {
  return new QuranPublicationError({ operation, reason });
}
/** Requires a complete active source identity for every public Quran read. */
export const decodePublishedQuranSource = Effect.fn("NakafaQuran.decodeSource")(
  function* (
    input: {
      readonly activeManifestHash: null | string;
      readonly activeReleaseId: null | string;
      readonly managed: boolean;
      readonly snapshotId: null | string;
      readonly sourceRevision: null | string;
    },
    operation: QuranPublicationOperation
  ) {
    if (!input.managed) {
      return yield* publicationError(
        operation,
        "Signed Quran publication is not active."
      );
    }
    return yield* Schema.decodeUnknownEffect(PublishedQuranSourceSchema)(
      input,
      {
        onExcessProperty: "ignore",
      }
    ).pipe(
      Effect.mapError(() =>
        publicationError(operation, "Signed Quran source identity is invalid.")
      )
    );
  }
);
/** Parses and strictly decodes one signed Quran JSON row. */
const decodeRow = Effect.fn("NakafaQuran.decodeRow")(function* <A, I>(
  source: string,
  snapshotId: PublishedQuranSource["snapshotId"],
  schema: Schema.Codec<A, I, never, never>,
  operation: QuranPublicationOperation
) {
  const input = yield* Effect.try({
    catch: () => publicationError(operation, "Quran row is not valid JSON."),
    try: (): unknown => JSON.parse(source),
  });
  const row = yield* Schema.decodeUnknownEffect(ContentSnapshotRowSchema)(
    input,
    {
      onExcessProperty: "error",
    }
  ).pipe(
    Effect.mapError(() =>
      publicationError(operation, "Quran row failed its signed contract.")
    )
  );
  if (row.family !== "quran" || row.record.snapshotId !== snapshotId) {
    return yield* publicationError(
      operation,
      "Quran row belongs to another signed snapshot."
    );
  }
  return yield* Schema.decodeUnknownEffect(schema)(row.record.payload, {
    onExcessProperty: "error",
  }).pipe(
    Effect.mapError(() =>
      publicationError(operation, "Quran row failed its signed contract.")
    )
  );
});
/** Decodes bounded chunks and returns their exact ordered verses. */
const decodeChunks = Effect.fn("NakafaQuran.decodeChunks")(function* (
  sources: readonly string[],
  snapshotId: PublishedQuranSource["snapshotId"],
  operation: QuranPublicationOperation,
  surahNumber: number
) {
  const chunks = yield* Effect.forEach(sources, (source) =>
    decodeRow(source, snapshotId, QuranChunkRowSchema, operation)
  );
  if (!hasContiguousChunks(chunks, surahNumber)) {
    return yield* publicationError(
      operation,
      "Quran chunks are missing, out of order, or belong to another surah."
    );
  }
  return chunks.flatMap((chunk: QuranChunkRow) => chunk.verses);
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
/** Decodes the complete active signed Quran metadata catalog. */
export const decodePublishedQuranCatalog = Effect.fn(
  "NakafaQuran.decodeCatalog"
)(function* (result: QuranCatalogResult) {
  const source = yield* decodePublishedQuranSource(result, "catalog");
  const surahs = yield* Effect.forEach(result.rowJson, (row) =>
    decodeRow(row, source.snapshotId, QuranSurahRowSchema, "catalog")
  );
  const ordered = surahs.every((surah, index) => surah.number === index + 1);
  if (surahs.length !== QURAN_SURAH_COUNT || !ordered) {
    return yield* publicationError(
      "catalog",
      "Signed Quran catalog is incomplete or out of order."
    );
  }
  return { ...source, surahs } satisfies PublishedQuranCatalog;
});
/** Decodes one bounded active signed Quran verse reference. */
export const decodePublishedQuranReference = Effect.fn(
  "NakafaQuran.decodeReference"
)(function* (
  result: QuranReferenceResult,
  expected: {
    readonly appLocale: AppLocaleCode;
    readonly surahNumber: number;
  }
) {
  const source = yield* decodePublishedQuranSource(result, "reference");
  if (result.surahJson === null || result.searchJson === null) {
    return yield* publicationError(
      "reference",
      "Signed Quran reference is missing."
    );
  }
  const [surah, search, chunkVerses] = yield* Effect.all([
    decodeRow(
      result.surahJson,
      source.snapshotId,
      QuranSurahRowSchema,
      "reference"
    ),
    decodeRow(
      result.searchJson,
      source.snapshotId,
      QuranSearchRowSchema,
      "reference"
    ),
    decodeChunks(
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
    surah.number !== expected.surahNumber ||
    result.fromVerse < 1 ||
    result.toVerse > surah.numberOfVerses ||
    !hasExactQuranVerseRange(verses, result.fromVerse, result.toVerse) ||
    !hasExpectedSearchIdentity(search, expected.appLocale, expected.surahNumber)
  ) {
    return yield* publicationError(
      "reference",
      "Signed Quran reference identity is inconsistent."
    );
  }
  return {
    ...source,
    fromVerse: result.fromVerse,
    search,
    surah,
    toVerse: result.toVerse,
    verses,
  } satisfies PublishedQuranReference;
});
