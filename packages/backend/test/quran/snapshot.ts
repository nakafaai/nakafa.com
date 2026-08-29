import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import {
  type Sha256Hash,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { ACTIVE_APP_LOCALES } from "@nakafa/aksara-contracts/locale";
import { makeQuranSnapshot as makeSignedQuranSnapshot } from "@nakafa/aksara-contracts/quran/snapshot/hash";
import type { QuranRowPayload } from "@nakafa/aksara-contracts/quran/snapshot/row";
import { bindQuranRow } from "@nakafa/aksara-contracts/quran/snapshot/row/hash";
import type { QuranSnapshotFacts } from "@nakafa/aksara-contracts/quran/snapshot/spec";
import { quranSourceFileCount } from "@nakafa/aksara-contracts/quran/source";
import {
  QURAN_ATTRIBUTION_COUNT,
  QURAN_SURAH_COUNT,
} from "@nakafa/aksara-contracts/quran/spec";
import {
  type ContentSnapshotManifest,
  type ContentSnapshotRow,
  canonicalizeContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import {
  inheritContentSnapshots,
  replaceContentSnapshot,
  restoreContentSnapshot,
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
} from "@repo/backend/test/content/release";
import { insertTestRelease } from "@repo/backend/test/content/stage";
import {
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content/state";
import { makeQuranSearch } from "@repo/backend/test/quran/rows";
import { Effect } from "effect";

const QURAN_SEARCH_COUNT = QURAN_SURAH_COUNT * ACTIVE_APP_LOCALES.length;
const QURAN_SOURCE_FILE_COUNT = quranSourceFileCount(ACTIVE_APP_LOCALES);
const QURAN_ROLLBACK_BASE_SNAPSHOT_ID = Sha256HashSchema.make(
  `sha256:${"f".repeat(64)}`
);

/** Creates the complete technical snapshot facts shared by test manifests. */
function makeQuranSnapshotFacts(
  provenanceStatus: QuranSnapshotFacts["provenanceStatus"]
): QuranSnapshotFacts {
  const chunkCount = 1085;
  const runtimeCount = QURAN_ATTRIBUTION_COUNT + QURAN_SURAH_COUNT + chunkCount;
  return {
    activeAppLocales: ACTIVE_APP_LOCALES,
    attributionCount: QURAN_ATTRIBUTION_COUNT,
    chunkCount,
    projectionCount: runtimeCount + QURAN_SEARCH_COUNT,
    projectionDigest: TEST_DIGEST,
    provenanceDigest: TEST_DIGEST,
    provenanceStatus,
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
}

/** Builds one schema-valid blocked Quran manifest without authored text. */
export function makeBlockedQuranSnapshot(): Extract<
  ContentSnapshotManifest,
  { readonly family: "quran" }
> {
  return {
    family: "quran",
    manifest: {
      ...makeQuranSnapshotFacts("blocked"),
      format: "localized-quran-snapshot",
      snapshotId: Sha256HashSchema.make(`sha256:${"4".repeat(64)}`),
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
    const manifest = yield* makeSignedQuranSnapshot(
      makeQuranSnapshotFacts("approved")
    );
    return {
      family: "quran",
      manifest,
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
  payloads: readonly QuranRowPayload[],
  options?: { readonly originReleaseId?: string }
) {
  const snapshot = await Effect.runPromise(makeQuranSnapshot());
  const snapshotId = snapshot.manifest.snapshotId;
  const records = await Effect.runPromise(
    Effect.forEach(payloads, (payload) => bindQuranRow(snapshotId, payload))
  );
  const snapshots = {
    ...inheritContentSnapshots(null),
    quran: options?.originReleaseId
      ? restoreContentSnapshot(QURAN_ROLLBACK_BASE_SNAPSHOT_ID, snapshotId)
      : replaceContentSnapshot({
          baseSnapshotId: null,
          resultSnapshotId: snapshotId,
          rowCount: records.length,
          rowDigest: snapshotId,
        }),
  };
  await insertTestRelease(ctx, {
    originReleaseId: options?.originReleaseId,
    snapshots,
  });
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

/** Restores the active technical Quran snapshot to its prior absent state. */
export async function restoreAbsentQuranSnapshot(
  ctx: MutationCtx,
  snapshotId: Sha256Hash
) {
  const active = {
    manifestHash: TEST_MANIFEST_HASH,
    releaseId: TEST_RELEASE_ID,
    sequence: 1,
  } satisfies TestIdentity;
  const recovery = {
    manifestHash: `sha256:${"9".repeat(64)}`,
    releaseId: "release-quran-recovery",
    sequence: 2,
  } satisfies TestIdentity;
  const snapshots = {
    ...inheritContentSnapshots(null),
    quran: restoreContentSnapshot(snapshotId, null),
  };
  await insertZeroRelease(ctx, {
    ...recovery,
    base: active,
    originReleaseId: active.releaseId,
    ownership: {
      base: ContentFamilySchema.literals,
      result: [],
    },
    role: "recovery",
    snapshots,
    status: "completed",
  });
  const state = await ctx.db.query("contentState").unique();
  if (!state) {
    throw new Error("Expected active technical Quran state.");
  }
  await ctx.db.patch("contentState", state._id, {
    activeManifestHash: recovery.manifestHash,
    activeReleaseId: recovery.releaseId,
    activeSequence: recovery.sequence,
    nextSequence: recovery.sequence + 1,
  });
}
