import type { Sha256Hash } from "@nakafa/aksara-contracts/ids";
import { bindQuranRow } from "@nakafa/aksara-contracts/quran/row-hash";
import {
  type QuranSnapshotManifest,
  QuranSnapshotManifestSchema,
} from "@nakafa/aksara-contracts/quran/snapshot";
import { hashQuranSnapshot } from "@nakafa/aksara-contracts/quran/snapshot-hash";
import { QuranSearchRowSchema } from "@nakafa/aksara-contracts/quran/spec";
import type {
  ContentSnapshotManifest,
  ContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot-data";
import { TEST_DIGEST } from "@repo/backend/test/content-release";
import { Effect, Schema } from "effect";

/** Creates one snapshot-bound technical Quran search row. */
export const makeQuranSnapshotRow = Effect.fn(
  "backendTest.makeQuranSnapshotRow"
)(function* (snapshotId: Sha256Hash) {
  const payload = Schema.decodeUnknownSync(QuranSearchRowSchema)({
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
    const identity: Omit<QuranSnapshotManifest, "snapshotId"> = {
      chunkCount: 1085,
      format: "quran-snapshot-v1",
      locales: ["en", "id"],
      projectionCount: 1427,
      projectionDigest: TEST_DIGEST,
      provenanceDigest: TEST_DIGEST,
      provenanceStatus: "approved",
      runtimeCount: 1199,
      runtimeDigest: TEST_DIGEST,
      searchCount: 228,
      searchDigest: TEST_DIGEST,
      sourceBytes: 1,
      sourceDigest: TEST_DIGEST,
      surahCount: 114,
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
