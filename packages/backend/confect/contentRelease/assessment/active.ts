import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  loadRelease,
  loadState,
} from "@repo/backend/confect/contentRelease/model";
import { decodeSnapshotJson } from "@repo/backend/confect/contentRelease/parse";
import { loadSnapshot } from "@repo/backend/confect/contentRelease/snapshot/manifest";
import { Effect, Option } from "effect";

/**
 * Reads the assessment snapshot that the active release selects: the release,
 * the snapshot identity every row is stored under, and the app locales the
 * snapshot covers. None when no release is active or the active release selects
 * no assessment snapshot. It reads the release's stored transition facts and
 * the small verified manifest, never the signed release text.
 */
export const findActiveAssessmentSnapshot = Effect.fn(
  "contentRelease.findActiveAssessmentSnapshot"
)(function* () {
  const releaseId = (yield* loadState())?.activeReleaseId;
  if (releaseId === undefined) {
    return Option.none();
  }
  const release = yield* loadRelease(releaseId);
  const snapshotId = release.snapshotTransitions.assessment.resultSnapshotId;
  if (snapshotId === null) {
    return Option.none();
  }
  const stored = yield* loadSnapshot("assessment", snapshotId);
  if (!stored || stored.verifiedAt === undefined) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active release ${releaseId} lost its verified assessment snapshot.`
    );
  }
  const snapshot = yield* decodeSnapshotJson(stored.snapshotJson);
  if (
    snapshot.family !== "assessment" ||
    snapshot.manifest.snapshotId !== snapshotId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Assessment snapshot ${snapshotId} lost its manifest identity.`
    );
  }
  return Option.some({
    activeAppLocales: snapshot.manifest.activeAppLocales,
    releaseId,
    snapshotId,
  });
});
