import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import {
  emptyContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot";
import type {
  ContentSnapshotManifest,
  ContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot-data";
import {
  canonicalizeContentSnapshotManifest,
  canonicalizeContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot-data";
import {
  compareTryoutCatalog,
  compareTryoutPlacements,
  tryoutCatalogIdentity,
  tryoutCatalogParentIdentity,
  tryoutPlacementIdentity,
  tryoutPlacementParentIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import {
  digestTryoutCatalog,
  digestTryoutPlacements,
  makeTryoutCatalogRecord,
  makeTryoutPlacementRecord,
} from "@nakafa/aksara-contracts/tryout/row-hash";
import { makeTryoutSnapshot } from "@nakafa/aksara-contracts/tryout/snapshot-hash";
import {
  type TryoutCatalogRow,
  TryoutCatalogRowSchema,
  type TryoutPlacement,
  TryoutPlacementSchema,
} from "@nakafa/aksara-contracts/tryout/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content-release";
import { insertTestRelease } from "@repo/backend/test/content-stage";
import { Effect, Schema, Stream } from "effect";

const artifactHash = Sha256HashSchema.make(`sha256:${"8".repeat(64)}`);

/** Creates one hashed technical try-out country row. */
export function makeTryoutCatalogRow(): Extract<
  ContentSnapshotRow,
  { readonly family: "tryout"; readonly rowKind: "catalog" }
> {
  const row = Schema.decodeUnknownSync(TryoutCatalogRowSchema)({
    countryCode: "ID",
    countryKey: "indonesia",
    graph: {
      alignmentId: "alignment:tryout:technical:country",
      assetId: "asset:en:tryout:technical:country",
      conceptId: "concept:tryout:technical:country",
      learningObjectId: "lo:tryout-technical-country",
      lensId: "lens:tryout:technical",
    },
    kind: "country",
    locale: "en",
    publicPath: "try-out/indonesia",
    sourceRevision: "technical-revision",
    title: "Technical country",
  });
  return {
    family: "tryout",
    record: makeTryoutCatalogRecord(row),
    rowKind: "catalog",
  };
}

/** Creates one hashed technical try-out question placement. */
export function makeTryoutPlacementRow(): Extract<
  ContentSnapshotRow,
  { readonly family: "tryout"; readonly rowKind: "placement" }
> {
  const row = Schema.decodeUnknownSync(TryoutPlacementSchema)({
    answerArtifactHash: artifactHash,
    answerContentKey:
      "question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-1/answer",
    choices: [
      {
        isCorrect: true,
        label: "Technical choice",
        optionKey: "option-1",
        order: 1,
      },
    ],
    countryKey: "indonesia",
    examKey: "snbt",
    locale: "en",
    questionArtifactHash: artifactHash,
    questionContentKey:
      "question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-1/question",
    questionOrder: 1,
    questionSourcePath:
      "packages/corpus/question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-1",
    rendererDomain: "snbt-quant",
    scope: "server",
    sectionKey: "quantitative-knowledge",
    setKey: "set-1",
    sourceRevision: "technical-revision",
    title: "Technical question",
    trackKey: "2027",
  });
  return {
    family: "tryout",
    record: makeTryoutPlacementRecord(row),
    rowKind: "placement",
  };
}

/** Creates one self-authenticating technical try-out snapshot manifest. */
export const makeTryoutSnapshotManifest = Effect.fn(
  "backendTest.makeTryoutSnapshotManifest"
)(function* () {
  const catalog = makeTryoutCatalogRow();
  const placement = makeTryoutPlacementRow();
  const catalogEvidence = yield* digestTryoutCatalog(
    Stream.make(catalog.record)
  );
  const placementEvidence = yield* digestTryoutPlacements(
    Stream.make(placement.record)
  );
  const manifest = makeTryoutSnapshot({
    catalogDigest: catalogEvidence.digest,
    counts: { country: 1, exam: 0, section: 0, set: 0, track: 0 },
    format: "tryout-v1",
    locales: ["en", "id"],
    placementCount: placementEvidence.count,
    placementDigest: placementEvidence.digest,
    routeCount: 1,
  });
  return {
    family: "tryout",
    manifest,
  } satisfies ContentSnapshotManifest;
});

/**
 * Activates exact schema-decoded try-out rows for one Convex integration test.
 *
 * Callers own the technical row values; this helper only applies the real
 * contract hashing, canonical storage, and active-release proof chain.
 */
export async function activateTryoutSnapshot(
  ctx: MutationCtx,
  input: {
    readonly catalog: readonly TryoutCatalogRow[];
    readonly placements: readonly TryoutPlacement[];
  }
) {
  const catalog = [...input.catalog]
    .sort(compareTryoutCatalog)
    .map(makeTryoutCatalogRecord);
  const placements = [...input.placements]
    .sort(compareTryoutPlacements)
    .map(makeTryoutPlacementRecord);
  const [catalogEvidence, placementEvidence] = await Effect.runPromise(
    Effect.all([
      digestTryoutCatalog(Stream.fromIterable(catalog)),
      digestTryoutPlacements(Stream.fromIterable(placements)),
    ])
  );
  const manifest = {
    family: "tryout" as const,
    manifest: makeTryoutSnapshot({
      catalogDigest: catalogEvidence.digest,
      counts: countCatalog(input.catalog),
      format: "tryout-v1",
      locales: ["en", "id"],
      placementCount: placementEvidence.count,
      placementDigest: placementEvidence.digest,
      routeCount: input.catalog.filter(
        (row) => "publicPath" in row && row.publicPath !== undefined
      ).length,
    }),
  };
  const snapshotId = manifest.manifest.snapshotId;
  const snapshots = {
    ...emptyContentSnapshots(),
    tryout: replaceContentSnapshot({
      baseSnapshotId: null,
      resultSnapshotId: snapshotId,
      rowCount: catalog.length + placements.length,
      rowDigest: snapshotId,
    }),
  };
  await insertTestRelease(ctx, { snapshots });
  await ctx.db.insert("contentSnapshots", {
    createdAt: 1,
    family: "tryout",
    retainUntil: Number.MAX_SAFE_INTEGER,
    snapshotId,
    snapshotJson: canonicalizeContentSnapshotManifest(manifest),
    verifiedAt: 1,
  });
  for (const [index, record] of catalog.entries()) {
    await insertCatalogRecord(ctx, snapshotId, index, record);
  }
  for (const [offset, record] of placements.entries()) {
    await insertPlacementRecord(
      ctx,
      snapshotId,
      catalog.length + offset,
      record
    );
  }
  const [release, state] = await Promise.all([
    ctx.db.query("contentReleases").unique(),
    ctx.db.query("contentState").unique(),
  ]);
  if (!(release && state)) {
    throw new Error("Expected one technical content release.");
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
  return snapshotId;
}

/** Counts each catalog kind for the signed technical manifest. */
function countCatalog(rows: readonly TryoutCatalogRow[]) {
  return {
    country: rows.filter(({ kind }) => kind === "country").length,
    exam: rows.filter(({ kind }) => kind === "exam").length,
    section: rows.filter(({ kind }) => kind === "section").length,
    set: rows.filter(({ kind }) => kind === "set").length,
    track: rows.filter(({ kind }) => kind === "track").length,
  };
}

/** Stores one canonical catalog record at its exact snapshot index. */
function insertCatalogRecord(
  ctx: MutationCtx,
  snapshotId: string,
  index: number,
  record: ReturnType<typeof makeTryoutCatalogRecord>
) {
  const { row } = record;
  return ctx.db.insert("tryoutCatalog", {
    identity: tryoutCatalogIdentity(row),
    index,
    kind: row.kind,
    locale: row.locale,
    order: row.kind === "set" || row.kind === "section" ? row.order : 0,
    parentKey: tryoutCatalogParentIdentity(row),
    publicPath: row.publicPath,
    rowHash: record.rowHash,
    rowJson: canonicalizeContentSnapshotRow({
      family: "tryout",
      record,
      rowKind: "catalog",
    }),
    snapshotId,
  });
}

/** Stores one canonical placement record at its exact snapshot index. */
function insertPlacementRecord(
  ctx: MutationCtx,
  snapshotId: string,
  index: number,
  record: ReturnType<typeof makeTryoutPlacementRecord>
) {
  const { row } = record;
  return ctx.db.insert("tryoutPlacements", {
    answerArtifactHash: row.answerArtifactHash,
    identity: tryoutPlacementIdentity(row),
    index,
    locale: row.locale,
    parentKey: tryoutPlacementParentIdentity(row),
    questionArtifactHash: row.questionArtifactHash,
    questionOrder: row.questionOrder,
    rowHash: record.rowHash,
    rowJson: canonicalizeContentSnapshotRow({
      family: "tryout",
      record,
      rowKind: "placement",
    }),
    snapshotId,
  });
}
