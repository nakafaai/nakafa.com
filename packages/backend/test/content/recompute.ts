import { ContentKeySchema, type ReleaseId } from "@nakafa/aksara-contracts/ids";
import { ArtifactLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  ContentReleaseItemSchema,
  ContentReleaseManifestSchema,
} from "@nakafa/aksara-contracts/release";
import { digestItems } from "@nakafa/aksara-contracts/release/digest";
import { digestRollbackSnapshot } from "@nakafa/aksara-contracts/release/rollback/digest";
import {
  canonicalizeRollbackSnapshotEntry,
  RollbackSnapshotEntrySchema,
} from "@nakafa/aksara-contracts/release/rollback/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseReachability } from "@repo/backend/convex/contentRelease/reachability";
import {
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import { Effect, Stream } from "effect";

/** Inserts a multi-page authenticated delete-only release. */
export const insertDeleteRelease = Effect.fn(
  "contentRelease.proof.verify.test.insertDeleteRelease"
)(function* (ctx: MutationCtx, count: number, releaseId: ReleaseId) {
  // Canonical head order compares content keys by code units, so the
  // multi-page fixture must be sorted rather than numerically indexed.
  const contentKeys = Array.from(
    { length: count },
    (_, ordinal) => `test:proof-${ordinal}`
  ).sort();
  const items = contentKeys.map((contentKey, index) =>
    ContentReleaseItemSchema.make({
      change: {
        contentKey: ContentKeySchema.make(contentKey),
        family: "material",
        artifactLocale: ArtifactLocaleSchema.make("en"),
        operation: "delete",
      },
      index,
      releaseId,
    })
  );
  const digest = yield* digestItems(releaseId, Stream.fromIterable(items)).pipe(
    Effect.orDie
  );
  const entries = items.map((item) => ({
    item,
    rollbackEntry: RollbackSnapshotEntrySchema.make({
      index: item.index,
      releaseId,
      snapshot: {
        contentKey: item.change.contentKey,
        family: item.change.family,
        artifactLocale: item.change.artifactLocale,
        state: "absent",
      },
    }),
  }));
  const rollback = yield* digestRollbackSnapshot(
    releaseId,
    Stream.fromIterable(entries.map(({ rollbackEntry }) => rollbackEntry))
  ).pipe(Effect.orDie);
  const nextManifest = ContentReleaseManifestSchema.make({
    ...testEmptyManifest(releaseId),
    deleteCount: count,
    itemCount: count,
    itemsDigest: digest.digest,
    rollbackCount: count,
    rollbackDigest: rollback.digest,
    upsertCount: 0,
  });
  const signed = testSignedRelease(nextManifest);
  const now = Date.UTC(2026, 6, 22, 12, 0, 0);
  yield* Effect.promise(() =>
    ctx.db.insert("contentReleases", {
      ...releaseReachability(signed),
      baseFamilies: [],
      checkedIndex: -1,
      checkedItems: 0,
      createdAt: now,
      releaseId,
      releaseJson: JSON.stringify(signed),
      rendererJson: JSON.stringify(TEST_PROOF_RENDERER),
      resultFamilies: [...signed.manifest.scope.families],
      role: "candidate",
      sequence: 1,
      stagedArtifacts: 0,
      stagedDeletes: count,
      stagedItems: count,
      stagedProjections: 0,
      stagedRoutes: 0,
      stagedSnapshotBatches: 0,
      stagedSnapshotRows: 0,
      stagedUpserts: 0,
      status: "staging",
      updatedAt: now,
    })
  );
  yield* Effect.promise(() =>
    ctx.db.insert("contentState", {
      articleSlot: "blue",
      candidateManifestHash: signed.manifestHash,
      candidateReleaseId: releaseId,
      candidateSequence: 1,
      key: "primary",
      materialSlot: "blue",
      nextSequence: 2,
      searchSlot: "blue",
      updatedAt: now,
    })
  );
  yield* Effect.forEach(
    entries,
    ({ item, rollbackEntry }) =>
      Effect.promise(() =>
        ctx.db.insert("contentItems", {
          artifactReady: false,
          contentKey: item.change.contentKey,
          index: item.index,
          itemBatchHash: digest.digest,
          itemBatchIndex: Math.floor(item.index / 4),
          itemJson: JSON.stringify(item),
          artifactLocale: item.change.artifactLocale,
          projectionReady: false,
          releaseId,
          rollbackJson: canonicalizeRollbackSnapshotEntry(rollbackEntry),
          sequence: 1,
          stagedAt: now,
        })
      ),
    { discard: true }
  );
  return signed.manifestHash;
});
