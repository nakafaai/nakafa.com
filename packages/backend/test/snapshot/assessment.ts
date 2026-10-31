import { assert } from "@effect/vitest";
import {
  AssessmentRowOrder,
  digestAssessmentRows,
  hashAssessmentRow,
  makeAssessmentSnapshot,
} from "@nakafa/aksara-contracts/assessment/snapshot";
import { ACTIVE_APP_LOCALES } from "@nakafa/aksara-contracts/locale";
import {
  type ContentSnapshotManifest,
  type ContentSnapshotRow,
  canonicalizeContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import {
  inheritContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import { assessmentRowFacts } from "@repo/backend/confect/contentRelease/assessment/facts";
import { encodeSnapshotJson } from "@repo/backend/confect/contentRelease/wire";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { makeAssessmentSnapshot as makeAssessmentFixture } from "@repo/backend/test/assessment/snapshot";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content/release";
import { insertTestRelease } from "@repo/backend/test/content/stage";
import { Array as Arr, Effect, Stream } from "effect";

/** The options of the shared assessment fixture: its sets, scoring, entry, and routes. */
type FixtureOptions = Parameters<typeof makeAssessmentFixture>[0];

/**
 * Builds the fixture snapshot as ingress receives it: every row of the shared
 * assessment fixture hashed and in canonical order, and the self-authenticating
 * manifest those rows digest to.
 */
export const makeAssessmentTestSnapshot = Effect.fn(
  "test.snapshot.assessmentSnapshot"
)(function* (options?: FixtureOptions) {
  const { rows } = yield* makeAssessmentFixture(options);
  const records = yield* Effect.forEach(
    Arr.sort(rows, AssessmentRowOrder),
    (row) => Effect.map(hashAssessmentRow(row), (rowHash) => ({ row, rowHash }))
  );
  const { counts, rowDigest } = yield* digestAssessmentRows(
    Stream.fromIterable(records)
  );
  const manifest = yield* makeAssessmentSnapshot({
    activeAppLocales: ACTIVE_APP_LOCALES,
    counts,
    rowDigest,
  });
  return {
    manifest: {
      family: "assessment",
      manifest,
    } satisfies ContentSnapshotManifest,
    rows: Arr.map(
      records,
      (record) =>
        ({ family: "assessment", record }) satisfies ContentSnapshotRow
    ),
  };
});

/**
 * Stores the fixture snapshot as the ingress mutation stores it: its verified
 * manifest and every row with its indexed facts. Returns the snapshot
 * identity and the stored snapshot rows.
 */
async function storeAssessmentTestSnapshot(
  ctx: MutationCtx,
  options?: FixtureOptions
) {
  const { manifest, rows } = await Effect.runPromise(
    makeAssessmentTestSnapshot(options)
  );
  const snapshotId = manifest.manifest.snapshotId;
  await ctx.db.insert("contentSnapshots", {
    createdAt: 1,
    family: "assessment",
    retainUntil: Number.MAX_SAFE_INTEGER,
    snapshotId,
    snapshotJson: encodeSnapshotJson(manifest),
    verifiedAt: 1,
  });
  await Promise.all(
    Arr.map(rows, (row, index) =>
      ctx.db.insert("assessmentRows", {
        ...assessmentRowFacts(row.record.row),
        index,
        rowHash: row.record.rowHash,
        rowJson: canonicalizeContentSnapshotRow(row),
        snapshotId,
      })
    )
  );
  return { manifest, rows, snapshotId };
}

/**
 * Activates the fixture snapshot in one Convex integration test: one
 * completed release that replaces the assessment snapshot, its verified
 * manifest, and every row stored as the ingress mutation stores it. Returns
 * the snapshot identity and its rows.
 */
export async function activateAssessmentTestSnapshot(
  ctx: MutationCtx,
  options?: FixtureOptions
) {
  const stored = await storeAssessmentTestSnapshot(ctx, options);
  await insertTestRelease(ctx, {
    snapshots: {
      ...inheritContentSnapshots(null),
      assessment: replaceContentSnapshot({
        baseSnapshotId: null,
        resultSnapshotId: stored.snapshotId,
        rowCount: stored.rows.length,
        rowDigest: stored.manifest.manifest.rowDigest,
      }),
    },
  });
  const [release, state] = await Promise.all([
    ctx.db.query("contentReleases").unique(),
    ctx.db.query("contentState").unique(),
  ]);
  assert.ok(release && state, "Expected one technical assessment release.");
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
  return stored;
}

/**
 * Moves the active release of an activated fixture onto another fixture
 * snapshot, as a later release that replaces the assessment snapshot does.
 * The earlier snapshot's rows stay stored, as retention keeps them while an
 * attempt names them. Returns the new snapshot identity and its rows.
 */
export async function replaceAssessmentTestSnapshot(
  ctx: MutationCtx,
  options?: FixtureOptions
) {
  const release = await ctx.db.query("contentReleases").unique();
  assert.ok(release, "Expected one activated assessment release.");
  const stored = await storeAssessmentTestSnapshot(ctx, options);
  await ctx.db.patch("contentReleases", release._id, {
    snapshotTransitions: {
      ...release.snapshotTransitions,
      assessment: {
        baseSnapshotId: release.snapshotTransitions.assessment.resultSnapshotId,
        mode: "replace",
        resultSnapshotId: stored.snapshotId,
      },
    },
  });
  return stored;
}
