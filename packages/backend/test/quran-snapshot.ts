import {
  type Sha256Hash,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { bindQuranRow } from "@nakafa/aksara-contracts/quran/row-hash";
import {
  QURAN_SNAPSHOT_FORMAT,
  type QuranSnapshotManifest,
  QuranSnapshotManifestSchema,
} from "@nakafa/aksara-contracts/quran/snapshot";
import { hashQuranSnapshot } from "@nakafa/aksara-contracts/quran/snapshot-hash";
import { QURAN_SOURCE_FILE_COUNT } from "@nakafa/aksara-contracts/quran/source";
import {
  QURAN_ATTRIBUTION_COUNT,
  QURAN_SEARCH_COUNT,
  QURAN_SURAH_COUNT,
  QuranSearchRowSchema,
} from "@nakafa/aksara-contracts/quran/spec";
import type {
  ContentSnapshotManifest,
  ContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot-data";
import { TEST_DIGEST } from "@repo/backend/test/content-release";
import { Effect, Schema } from "effect";

/** Builds one schema-valid blocked Quran manifest without authored text. */
export function makeBlockedQuranSnapshot(): Extract<
  ContentSnapshotManifest,
  { readonly family: "quran" }
> {
  const chunkCount = 1085;
  const runtimeCount = QURAN_ATTRIBUTION_COUNT + QURAN_SURAH_COUNT + chunkCount;
  return {
    family: "quran",
    manifest: {
      attributionCount: QURAN_ATTRIBUTION_COUNT,
      chunkCount,
      format: QURAN_SNAPSHOT_FORMAT,
      locales: ["en", "id"],
      projectionCount: runtimeCount + QURAN_SEARCH_COUNT,
      projectionDigest: TEST_DIGEST,
      provenanceDigest: TEST_DIGEST,
      provenanceStatus: "blocked",
      runtimeCount,
      runtimeDigest: TEST_DIGEST,
      searchCount: QURAN_SEARCH_COUNT,
      searchDigest: TEST_DIGEST,
      snapshotId: Sha256HashSchema.make(`sha256:${"4".repeat(64)}`),
      sourceBytes: 1,
      sourceDigest: TEST_DIGEST,
      sourceFileCount: QURAN_SOURCE_FILE_COUNT,
      surahCount: QURAN_SURAH_COUNT,
      tafsirLocales: ["id"],
      verseCount: 6236,
    },
  };
}

/** Creates one snapshot-bound technical Quran search row. */
export const makeQuranSnapshotRow = Effect.fn(
  "backendTest.makeQuranSnapshotRow"
)(function* (snapshotId: Sha256Hash) {
  const payload = yield* Schema.decodeUnknown(QuranSearchRowSchema)({
    description: "Technical Quran search row",
    graph: {
      alignmentId: "alignment:quran:quran-surah:1",
      assetId: "asset:en:quran:quran-surah:1",
      conceptId: "concept:quran:surah:1",
      learningObjectId: "lo:quran-surah:1",
      lensId: "lens:quran",
    },
    kind: "quran-search",
    locale: "en",
    route: "quran/1",
    surahNumber: 1,
    text: "Technical search text",
    title: "Technical surah",
  });
  const record = yield* bindQuranRow(snapshotId, payload);
  return {
    family: "quran",
    record,
  } satisfies ContentSnapshotRow;
});

/** Creates one self-authenticating technical Quran snapshot manifest. */
export const makeQuranSnapshot = Effect.fn("backendTest.makeQuranSnapshot")(
  function* () {
    const chunkCount = 1085;
    const runtimeCount =
      QURAN_ATTRIBUTION_COUNT + QURAN_SURAH_COUNT + chunkCount;
    const identity: Omit<QuranSnapshotManifest, "snapshotId"> = {
      attributionCount: QURAN_ATTRIBUTION_COUNT,
      chunkCount,
      format: QURAN_SNAPSHOT_FORMAT,
      locales: ["en", "id"],
      projectionCount: runtimeCount + QURAN_SEARCH_COUNT,
      projectionDigest: TEST_DIGEST,
      provenanceDigest: TEST_DIGEST,
      provenanceStatus: "approved",
      runtimeCount,
      runtimeDigest: TEST_DIGEST,
      searchCount: QURAN_SEARCH_COUNT,
      searchDigest: TEST_DIGEST,
      sourceBytes: 1,
      sourceDigest: TEST_DIGEST,
      sourceFileCount: QURAN_SOURCE_FILE_COUNT,
      surahCount: QURAN_SURAH_COUNT,
      tafsirLocales: ["id"],
      verseCount: 6236,
    };
    const snapshotId = yield* hashQuranSnapshot(identity);
    return {
      family: "quran",
      manifest: QuranSnapshotManifestSchema.make({ ...identity, snapshotId }),
    } satisfies ContentSnapshotManifest;
  }
);
