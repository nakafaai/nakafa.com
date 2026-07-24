import {
  emptyContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot";
import {
  canonicalizeContentSnapshotManifest,
  canonicalizeContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot-data";
import {
  compareTryoutCatalog,
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
  TryoutCatalogRowSchema,
  TryoutPlacementSchema,
} from "@nakafa/aksara-contracts/tryout/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content-release";
import { insertTestRelease } from "@repo/backend/test/content-stage";
import {
  TRYOUT_SECTION_KEY,
  TRYOUT_SECTION_PATH,
  TRYOUT_SOURCE,
} from "@repo/backend/test/tryouts";
import { Effect, Schema, Stream } from "effect";

export const TRYOUT_IDENTITY_HASH = `sha256:${"8".repeat(64)}` as const;
const aksaraSource = `packages/corpus/${TRYOUT_SOURCE}`;
const graph = {
  alignmentId: "alignment:tryout:test",
  assetId: "asset:id:tryout:test",
  conceptId: "concept:tryout:test",
  learningObjectId: "lo:tryout:test",
  lensId: "lens:tryout",
};
const setRow = Schema.decodeUnknownSync(TryoutCatalogRowSchema)({
  countryKey: "indonesia",
  examKey: "snbt",
  graph,
  kind: "set",
  locale: "id",
  order: 1,
  publicPath: "try-out/indonesia/snbt/2027/set-1",
  questionCount: 1,
  scoringStrategy: "irt",
  sectionCount: 1,
  setKey: "set-1",
  sourceRevision: "2026",
  title: "Set 1",
  trackKey: "2027",
  visibleSectionCount: 1,
});
const sectionRow = Schema.decodeUnknownSync(TryoutCatalogRowSchema)({
  countryKey: "indonesia",
  examKey: "snbt",
  graph,
  kind: "section",
  locale: "id",
  order: 1,
  publicPath: TRYOUT_SECTION_PATH,
  questionCount: 1,
  questionSourcePath: aksaraSource,
  sectionKey: TRYOUT_SECTION_KEY,
  setKey: "set-1",
  sourceRevision: "2026",
  timeLimitSeconds: 1800,
  title: "Penalaran Matematika",
  trackKey: "2027",
  visibility: "visible",
});
export const tryoutIdentityPlacement = Schema.decodeUnknownSync(
  TryoutPlacementSchema
)({
  answerArtifactHash: TRYOUT_IDENTITY_HASH,
  answerContentKey: `${TRYOUT_SOURCE}/question-1/answer`,
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
  locale: "id",
  questionArtifactHash: TRYOUT_IDENTITY_HASH,
  questionContentKey: `${TRYOUT_SOURCE}/question-1/question`,
  questionOrder: 1,
  questionSourcePath: `${aksaraSource}/question-1`,
  rendererDomain: "snbt-math",
  scope: "server",
  sectionKey: TRYOUT_SECTION_KEY,
  setKey: "set-1",
  sourceRevision: "2026",
  title: "Technical question",
  trackKey: "2027",
});

/** Builds and activates one exact technical Aksara try-out snapshot. */
export async function activateTryoutIdentitySnapshot(ctx: MutationCtx) {
  const set = makeTryoutCatalogRecord(setRow);
  const section = makeTryoutCatalogRecord(sectionRow);
  const placement = makeTryoutPlacementRecord(tryoutIdentityPlacement);
  const catalogRecords = [set, section].sort((left, right) =>
    compareTryoutCatalog(left.row, right.row)
  );
  const [catalog, placements] = await Effect.runPromise(
    Effect.all([
      digestTryoutCatalog(Stream.fromIterable(catalogRecords)),
      digestTryoutPlacements(Stream.make(placement)),
    ])
  );
  const manifest = {
    family: "tryout" as const,
    manifest: makeTryoutSnapshot({
      catalogDigest: catalog.digest,
      counts: { country: 0, exam: 0, section: 1, set: 1, track: 0 },
      format: "tryout-v1",
      locales: ["en", "id"],
      placementCount: 1,
      placementDigest: placements.digest,
      routeCount: 2,
    }),
  };
  const snapshots = {
    ...emptyContentSnapshots(),
    tryout: replaceContentSnapshot({
      baseSnapshotId: null,
      resultSnapshotId: manifest.manifest.snapshotId,
      rowCount: 3,
      rowDigest: manifest.manifest.snapshotId,
    }),
  };
  await insertTestRelease(ctx, { snapshots });
  await ctx.db.insert("contentSnapshots", {
    createdAt: 1,
    family: "tryout",
    retainUntil: Number.MAX_SAFE_INTEGER,
    snapshotId: manifest.manifest.snapshotId,
    snapshotJson: canonicalizeContentSnapshotManifest(manifest),
    verifiedAt: 1,
  });
  await insertCatalog(ctx, manifest.manifest.snapshotId, 0, setRow, set);
  await insertCatalog(
    ctx,
    manifest.manifest.snapshotId,
    1,
    sectionRow,
    section
  );
  await ctx.db.insert("tryoutPlacements", {
    answerArtifactHash: tryoutIdentityPlacement.answerArtifactHash,
    identity: tryoutPlacementIdentity(tryoutIdentityPlacement),
    index: 2,
    locale: tryoutIdentityPlacement.locale,
    parentKey: tryoutPlacementParentIdentity(tryoutIdentityPlacement),
    questionArtifactHash: tryoutIdentityPlacement.questionArtifactHash,
    questionOrder: tryoutIdentityPlacement.questionOrder,
    rowHash: placement.rowHash,
    rowJson: canonicalizeContentSnapshotRow({
      family: "tryout",
      record: placement,
      rowKind: "placement",
    }),
    snapshotId: manifest.manifest.snapshotId,
  });
  const [release, state] = await Promise.all([
    ctx.db.query("contentReleases").unique(),
    ctx.db.query("contentState").unique(),
  ]);
  if (!(release && state)) {
    throw new Error("Expected one technical release.");
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
  return manifest.manifest.snapshotId;
}

/** Stores one physical hierarchy row through its canonical envelope. */
function insertCatalog(
  ctx: MutationCtx,
  snapshotId: string,
  index: number,
  row: typeof setRow | typeof sectionRow,
  record: ReturnType<typeof makeTryoutCatalogRecord>
) {
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
