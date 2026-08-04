import {
  type Sha256Hash,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { bindQuranRow } from "@nakafa/aksara-contracts/quran/row-hash";
import { hashQuranSnapshot } from "@nakafa/aksara-contracts/quran/snapshot/hash";
import {
  QURAN_SNAPSHOT_FORMAT,
  type QuranSnapshotManifest,
  QuranSnapshotManifestSchema,
} from "@nakafa/aksara-contracts/quran/snapshot/spec";
import { QURAN_SOURCE_FILE_COUNT } from "@nakafa/aksara-contracts/quran/source";
import {
  QURAN_ATTRIBUTION_COUNT,
  QURAN_SEARCH_COUNT,
  QURAN_SURAH_COUNT,
  type QuranRowPayload,
} from "@nakafa/aksara-contracts/quran/spec";
import {
  type ContentSnapshotManifest,
  type ContentSnapshotRow,
  canonicalizeContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import {
  inheritContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  quranRowFacts,
  quranSearchFacts,
} from "@repo/backend/convex/contentRelease/quran/facts";
import { encodeSnapshotJson } from "@repo/backend/convex/contentRelease/wire";
import {
  TEST_DIGEST,
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content-release";
import { insertTestRelease } from "@repo/backend/test/content-stage";
import { makeQuranSearch } from "@repo/backend/test/quran-rows";
import { Effect } from "effect";

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

/** Creates one snapshot-bound technical Quran row. */
export const makeQuranSnapshotRow = Effect.fn(
  "backendTest.makeQuranSnapshotRow"
)(function* (
  snapshotId: Sha256Hash,
  payload: QuranRowPayload = makeQuranSearch("en", 1, "Technical search text")
) {
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

/** Promotes the only staged technical release to the active slot. */
async function completeTestRelease(ctx: MutationCtx) {
  const [release, state] = await Promise.all([
    ctx.db.query("contentReleases").unique(),
    ctx.db.query("contentState").unique(),
  ]);
  if (!(release && state)) {
    throw new Error("Expected one technical Quran release.");
  }
  await ctx.db.patch("contentReleases", release._id, {
    completedAt: 1,
    status: "completed",
  });
  await ctx.db.patch("contentState", state._id, {
    activeManifestHash: TEST_MANIFEST_HASH,
    activeReleaseId: TEST_RELEASE_ID,
    activeSequence: 1,
    candidateManifestHash: undefined,
    candidateReleaseId: undefined,
    candidateSequence: undefined,
  });
}

/** Activates one source-backed release that does not yet own Quran. */
export async function activateQuranSource(ctx: MutationCtx) {
  await insertTestRelease(ctx);
  await completeTestRelease(ctx);
}

/** Activates explicit technical rows under one approved Quran snapshot. */
export async function activateQuranSnapshot(
  ctx: MutationCtx,
  payloads: readonly QuranRowPayload[]
) {
  const snapshot = await Effect.runPromise(makeQuranSnapshot());
  const snapshotId = snapshot.manifest.snapshotId;
  const records = await Effect.runPromise(
    Effect.forEach(payloads, (payload) => bindQuranRow(snapshotId, payload))
  );
  const snapshots = {
    ...inheritContentSnapshots(null),
    quran: replaceContentSnapshot({
      baseSnapshotId: null,
      resultSnapshotId: snapshotId,
      rowCount: records.length,
      rowDigest: snapshotId,
    }),
  };
  await insertTestRelease(ctx, { snapshots });
  await ctx.db.insert("contentSnapshots", {
    createdAt: 1,
    family: "quran",
    retainUntil: Number.MAX_SAFE_INTEGER,
    snapshotId,
    snapshotJson: encodeSnapshotJson(snapshot),
    verifiedAt: 1,
  });
  for (const [index, record] of records.entries()) {
    const search =
      record.payload.kind === "quran-search"
        ? quranSearchFacts(record.payload)
        : null;
    await ctx.db.insert("quranRows", {
      ...quranRowFacts(record),
      index,
      rowHash: record.rowHash,
      rowJson: canonicalizeContentSnapshotRow({ family: "quran", record }),
      snapshotId,
    });
    if (search !== null) {
      await ctx.db.insert("quranSearch", {
        ...search,
        index,
        rowHash: record.rowHash,
        snapshotId,
      });
    }
  }
  await completeTestRelease(ctx);
  return snapshotId;
}
