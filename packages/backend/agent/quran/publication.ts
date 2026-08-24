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
import type { readQuranSurahs } from "@repo/backend/convex/contentRelease/quran/catalog";
import type { quranMarkdownValidator } from "@repo/backend/convex/contentRelease/quran/markdown";
import type { readQuranReference } from "@repo/backend/convex/contentRelease/quran/reference";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import type { Infer } from "convex/values";
import { Effect, Schema } from "effect";

type QuranCatalogResult = Effect.Success<ReturnType<typeof readQuranSurahs>>;
type QuranReferenceResult = Effect.Success<
  ReturnType<typeof readQuranReference>
>;
type QuranMarkdownResult = Infer<typeof quranMarkdownValidator>;
type QuranChunkRow = typeof QuranChunkRowSchema.Type;
type QuranSearchRow = typeof QuranSearchRowSchema.Type;
type QuranPublicationOperation = "catalog" | "markdown" | "reference";

const PublishedQuranSourceSchema = Schema.Struct({
  activeManifestHash: Sha256HashSchema,
  activeReleaseId: ReleaseIdSchema,
  snapshotId: Sha256HashSchema,
  sourceRevision: GitCommitShaSchema,
});
type PublishedQuranSource = typeof PublishedQuranSourceSchema.Type;

export interface PublishedQuranCatalog extends PublishedQuranSource {
  readonly surahs: readonly QuranSurahRow[];
}

export interface PublishedQuranReference extends PublishedQuranSource {
  readonly fromVerse: number;
  readonly search: QuranSearchRow;
  readonly surah: QuranSurahRow;
  readonly toVerse: number;
  readonly verses: readonly QuranRuntimeVerse[];
}

/** Decodes the complete active signed Quran metadata catalog. */
export const decodeAgentQuranCatalog = Effect.fn("agent.quran.decodeCatalog")(
  function* (result: QuranCatalogResult) {
    const source = yield* decodeSource(result, "catalog");
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
  }
);

/** Decodes one bounded active signed Quran verse reference. */
export const decodeAgentQuranReference = Effect.fn(
  "agent.quran.decodeReference"
)(function* (
  result: QuranReferenceResult,
  expected: { readonly appLocale: AppLocaleCode; readonly surahNumber: number }
) {
  const source = yield* decodeSource(result, "reference");
  if (result.surahJson === null || result.searchJson === null) {
    return yield* publicationError(
      "reference",
      "Signed Quran reference is missing."
    );
  }
  const [surah, search, chunks] = yield* Effect.all([
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
    decodeChunks(result.chunkJson, source.snapshotId, expected.surahNumber),
  ]);
  const verses = chunks.filter(
    (verse) =>
      verse.number.inSurah >= result.fromVerse &&
      verse.number.inSurah <= result.toVerse
  );
  if (
    surah.number !== expected.surahNumber ||
    !hasExactVerseRange(verses, result.fromVerse, result.toVerse) ||
    search.appLocale !== expected.appLocale ||
    search.surahNumber !== expected.surahNumber ||
    search.route !== `quran/${expected.surahNumber}`
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

/** Verifies the narrow signed projection used for Quran Markdown. */
export const decodeAgentQuranMarkdown = Effect.fn("agent.quran.decodeMarkdown")(
  function* (
    result: QuranMarkdownResult,
    expected: {
      readonly appLocale: AppLocaleCode;
      readonly surahNumber: number;
    }
  ) {
    const source = yield* decodeSource(result, "markdown");
    if (result.surah === null) {
      return yield* publicationError(
        "markdown",
        "Signed Quran content is missing."
      );
    }
    if (
      result.appLocale !== expected.appLocale ||
      result.surah.number !== expected.surahNumber ||
      result.toVerse !== result.surah.numberOfVerses ||
      !hasExactVerseRange(result.verses, 1, result.toVerse)
    ) {
      return yield* publicationError(
        "markdown",
        "Signed Quran markdown identity is inconsistent."
      );
    }
    return { ...source, ...result, surah: result.surah };
  }
);

/** Requires a complete active source identity for every Quran read. */
const decodeSource = Effect.fn("agent.quran.decodeSource")(function* (
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
  return yield* Schema.decodeUnknownEffect(PublishedQuranSourceSchema)(input, {
    onExcessProperty: "ignore",
  }).pipe(
    Effect.mapError(() =>
      publicationError(operation, "Signed Quran source identity is invalid.")
    )
  );
});

/** Parses and strictly decodes one immutable signed Quran row. */
const decodeRow = Effect.fn("agent.quran.decodeRow")(function* <A, I>(
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
    { onExcessProperty: "error" }
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

/** Decodes ordered chunks and returns their exact verses. */
const decodeChunks = Effect.fn("agent.quran.decodeChunks")(function* (
  sources: readonly string[],
  snapshotId: PublishedQuranSource["snapshotId"],
  surahNumber: number
) {
  const chunks = yield* Effect.forEach(sources, (source) =>
    decodeRow(source, snapshotId, QuranChunkRowSchema, "reference")
  );
  if (!hasContiguousChunks(chunks, surahNumber)) {
    return yield* publicationError(
      "reference",
      "Quran chunks are incomplete, out of order, or from another surah."
    );
  }
  return chunks.flatMap((chunk) => chunk.verses);
});

/** Checks cross-chunk ordering that individual row schemas cannot see. */
function hasContiguousChunks(
  chunks: readonly QuranChunkRow[],
  surahNumber: number
) {
  if (chunks.length === 0) {
    return false;
  }
  return chunks.every((chunk, index) => {
    if (chunk.surahNumber !== surahNumber || index === 0) {
      return chunk.surahNumber === surahNumber;
    }
    const previous = chunks[index - 1];
    const previousVerse = previous?.verses.at(-1);
    return Boolean(
      previous &&
        previousVerse &&
        chunk.firstVerse === previous.lastVerse + 1 &&
        chunk.firstQuranNumber === previousVerse.number.inQuran + 1
    );
  });
}

/** Checks that one verse list exactly covers the requested local range. */
function hasExactVerseRange(
  verses: readonly { readonly number: { readonly inSurah: number } }[],
  fromVerse: number,
  toVerse: number
) {
  return (
    Number.isSafeInteger(fromVerse) &&
    Number.isSafeInteger(toVerse) &&
    fromVerse >= 1 &&
    toVerse >= fromVerse &&
    verses.length === toVerse - fromVerse + 1 &&
    verses.every((verse, index) => verse.number.inSurah === fromVerse + index)
  );
}

/** Creates one closed signed-publication failure. */
function publicationError(operation: QuranPublicationOperation, cause: string) {
  return new NakafaAgentDataReadError({
    cause,
    message: `Unable to read signed Nakafa Quran ${operation}.`,
  });
}
