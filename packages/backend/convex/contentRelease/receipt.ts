import type {
  ContentReleaseManifest,
  SignedContentRelease,
} from "@nakafa/aksara-contracts/release";
import { snapshotRowCount } from "@nakafa/aksara-contracts/release/snapshot";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { decodeReceiptJson } from "@repo/backend/convex/contentRelease/parse";
import { Effect } from "effect";

/** Checks that every staged counter is an exact nonnegative integer. */
function hasStageCounters(release: Doc<"contentReleases">) {
  return [
    release.stagedArtifacts,
    release.stagedDeletes,
    release.stagedItems,
    release.stagedProjections,
    release.stagedRoutes,
    release.stagedSnapshotBatches,
    release.stagedSnapshotRows,
    release.stagedUpserts,
  ].every((value) => Number.isSafeInteger(value) && value >= 0);
}

/** Checks the durable verifier cursor against the signed item count. */
function hasCheckedCursor(
  release: Doc<"contentReleases">,
  manifest: ContentReleaseManifest
) {
  return (
    release.checkedItems === manifest.itemCount &&
    release.checkedIndex === manifest.itemCount - 1
  );
}

/** Derives the exact publication receipt from signed immutable counts. */
export function makePublicationReceipt(
  release: Doc<"contentReleases">,
  signed: SignedContentRelease
) {
  const manifest = signed.manifest;
  return {
    activatedHeads: release.stagedUpserts,
    deletedHeads: release.stagedDeletes,
    manifestHash: signed.manifestHash,
    projectionDigest: manifest.projectionDigest,
    releaseId: release.releaseId,
    resultCount: manifest.resultCount,
    resultDigest: manifest.resultDigest,
    routeDigest: manifest.routeDigest,
    snapshots: manifest.snapshots,
    stagedArtifacts: release.stagedArtifacts,
    stagedItems: release.stagedItems,
    stagedProjections: release.stagedProjections,
    stagedRoutes: release.stagedRoutes,
    stagedSnapshotRows: release.stagedSnapshotRows,
  };
}

/** Binds one receipt to every signed immutable operation count. */
export const publicationReceipt = Effect.fn(
  "contentRelease.publicationReceipt"
)(function* (release: Doc<"contentReleases">, signed: SignedContentRelease) {
  const manifest = signed.manifest;
  const bound =
    release.releaseId === manifest.releaseId &&
    release.stagedArtifacts === manifest.upsertCount &&
    release.stagedDeletes === manifest.deleteCount &&
    release.stagedItems === manifest.itemCount &&
    release.stagedProjections === manifest.projectionCount &&
    release.stagedUpserts === manifest.upsertCount &&
    release.stagedRoutes === manifest.routeCount;
  const snapshotsBound =
    release.stagedSnapshotRows === snapshotRowCount(manifest.snapshots);
  if (!(bound && snapshotsBound)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Content release ${release.releaseId} lost signed count evidence.`
    );
  }
  return makePublicationReceipt(release, signed);
});

/** Validates resumable preactivation counters and verifier progress. */
export const stagedEvidence = Effect.fn("contentRelease.stagedEvidence")(
  function* (release: Doc<"contentReleases">, signed: SignedContentRelease) {
    const manifest = signed.manifest;
    const staging = release.status === "staging";
    const checking = release.status === "verifying";
    const verified = release.status === "verified";
    const partial =
      hasStageCounters(release) &&
      Number.isSafeInteger(release.checkedItems) &&
      release.checkedItems >= 0 &&
      release.checkedItems <= release.stagedItems &&
      release.checkedIndex === release.checkedItems - 1 &&
      release.stagedItems <= manifest.itemCount &&
      release.stagedDeletes + release.stagedUpserts === release.stagedItems &&
      release.stagedDeletes <= manifest.deleteCount &&
      release.stagedUpserts <= manifest.upsertCount &&
      release.stagedArtifacts <= release.stagedUpserts &&
      release.stagedProjections <= release.stagedUpserts &&
      release.stagedRoutes <= manifest.routeCount &&
      release.stagedSnapshotBatches >= 0 &&
      release.stagedSnapshotRows <= snapshotRowCount(manifest.snapshots) &&
      release.completedAt === undefined &&
      release.receiptJson === undefined &&
      (staging || checking || verified);
    if (!partial) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Pending release ${release.releaseId} lost durable progress.`
      );
    }
    if (!verified) {
      if (
        release.proofAt !== undefined ||
        release.proofJson !== undefined ||
        release.verifiedAt !== undefined
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Pending release ${release.releaseId} has premature proof evidence.`
        );
      }
      return;
    }
    yield* publicationReceipt(release, signed);
    if (
      release.proofAt === undefined ||
      release.proofJson === undefined ||
      release.verifiedAt === undefined ||
      !hasCheckedCursor(release, manifest)
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Verified release ${release.releaseId} lost proof evidence.`
      );
    }
  }
);

/** Validates terminal durability before exposing active release evidence. */
export const completedReceipt = Effect.fn("contentRelease.completedReceipt")(
  function* (release: Doc<"contentReleases">, signed: SignedContentRelease) {
    const expected = yield* publicationReceipt(release, signed);
    if (
      release.status !== "completed" ||
      release.completedAt === undefined ||
      release.proofAt === undefined ||
      release.proofJson === undefined ||
      release.verifiedAt === undefined ||
      !hasCheckedCursor(release, signed.manifest) ||
      !release.receiptJson
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Completed release ${release.releaseId} lost terminal evidence.`
      );
    }
    const stored = yield* decodeReceiptJson(release.receiptJson);
    if (JSON.stringify(stored) !== JSON.stringify(expected)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Completed release ${release.releaseId} has mismatched receipt evidence.`
      );
    }
    return stored;
  }
);
